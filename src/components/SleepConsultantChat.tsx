import { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import type { BabyProfile, DailyRhythmState } from '../types/sleep';
import { getWakeWindowForAge } from '../utils/scheduleEngine';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface SleepConsultantChatProps {
  profile: BabyProfile;
  rhythm: DailyRhythmState;
  lastNapDurationMinutes?: number;
}

const QUICK_CHIPS = [
  'When should I put my baby to sleep?',
  'Should I do a bridge nap?',
  'How do I fix day/night confusion?',
];

function answerQuestion(
  question: string,
  profile: BabyProfile,
  rhythm: DailyRhythmState,
  lastNapDurationMinutes?: number,
): string {
  const q = question.toLowerCase();
  const range = getWakeWindowForAge(profile.ageWeeks);

  if (q.includes('put') && (q.includes('sleep') || q.includes('down') || q.includes('bed'))) {
    if (rhythm.currentPhase === 'SWEET_SPOT') {
      return `Right now. You're in the optimal sleep window — about ${rhythm.remainingMinutesToSweetSpot} minutes of cushion left. At ${profile.ageWeeks} weeks, the sweet spot is ~${range.sweetSpot} minutes awake. Put baby down before cortisol climbs.`;
    }
    if (rhythm.currentPhase === 'WIND_DOWN') {
      return `Very soon. Wind-down is active with ${rhythm.remainingMinutesToSweetSpot} minutes until the sweet spot. Dim lights, start the feed/book/song routine, and aim to be placing baby down as the timer hits zero.`;
    }
    if (rhythm.currentPhase === 'OVERTIRED') {
      return `As soon as you can soothe them. You've passed the ${range.sweetSpot}m window (${rhythm.elapsedAwakeMinutes}m awake). Extra rocking, white noise, and a feed can help override the cortisol spike. Expect a longer settle tonight.`;
    }
    return `Not yet — still in active awake time with ${rhythm.remainingMinutesToSweetSpot} minutes until the sweet spot. Keep play gentle and watch for: ${rhythm.cuesToWatch.join(', ')}.`;
  }

  if (q.includes('bridge')) {
    const hasBridge = rhythm.schedule.some(
      (b) => b.isAdjusted && b.title.toLowerCase().includes('bridge'),
    );
    if (hasBridge) {
      return `Yes — today's schedule already suggests an optional 15-minute bridge nap because the last daytime nap ends more than 3.5 hours before ${profile.targetBedtime}. Keep it short so it doesn't push bedtime later.`;
    }
    return `Only if the gap from the last nap end to bedtime (${profile.targetBedtime}) stretches past ~3.5 hours. Otherwise skip it — at ${profile.ageWeeks} weeks, protecting night sleep matters more than squeezing an extra catnap.`;
  }

  if (q.includes('day') && q.includes('night')) {
    return `Day/night confusion is common under 8–10 weeks. Load daytime with bright natural light, conversation, and full feeds. Keep nights dark, boring, and quiet — even for feeds. Cap any single day nap under 120 minutes so night sleep pressure builds. Morning wake at ${profile.morningWakeTime} is your circadian anchor.`;
  }

  if (q.includes('short nap') || q.includes('disaster') || (q.includes('nap') && q.includes('short'))) {
    const napNote =
      lastNapDurationMinutes !== undefined
        ? `Your last logged nap was ${lastNapDurationMinutes}m. `
        : '';
    return `${napNote}Naps under 35 minutes leave residual adenosine sleep pressure. RhythmShift contracts the next wake window by 20 minutes so you can catch the next sweet spot earlier — don't stretch to the full ${range.sweetSpot}m.`;
  }

  if (q.includes('feed') || q.includes('cluster')) {
    return `At ${profile.ageWeeks} weeks, cluster feeding in the evening is normal. Offer a full feed during wind-down before ${profile.targetBedtime}, then keep overnight feeds calm and dark. Logging feeds via voice ("fed 15 minutes ago") helps the rhythm engine contextualize sleep pressure.`;
  }

  return `At ${profile.ageWeeks} weeks, aim for ~${range.min}–${range.max} minute wake windows (sweet spot ${range.sweetSpot}m, hard max ${range.absoluteMax}m). Current phase: ${rhythm.currentPhase.replace(/_/g, ' ')}. ${rhythm.activeGuidance} Ask about bedtime timing, bridge naps, or day/night confusion for a more specific plan.`;
}

export function SleepConsultantChat({
  profile,
  rhythm,
  lastNapDurationMinutes,
}: SleepConsultantChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hi — I'm your on-device sleep consultant for ${profile.name} (${profile.ageWeeks} weeks). Ask anything about wake windows, bridge naps, or tonight's bedtime.`,
    },
  ]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const reply: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: answerQuestion(trimmed, profile, rhythm, lastNapDurationMinutes),
    };
    setMessages((prev) => [...prev, userMsg, reply]);
    setInput('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-28 left-3 z-30 inline-flex items-center gap-2 rounded-full bg-indigo-500 text-white px-4 py-2.5 text-sm font-medium shadow-lg shadow-indigo-900/40 hover:bg-indigo-400 transition"
      >
        <MessageCircle className="h-4 w-4" />
        Ask sleep coach
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-t-3xl border border-slate-600/60 bg-slate-900 shadow-2xl max-h-[85vh] flex flex-col"
            role="dialog"
            aria-label="Sleep consultant"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
              <div>
                <h2 className="font-semibold text-slate-50">Sleep Consultant</h2>
                <p className="text-xs text-slate-400">On-device answers · no API required</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[240px]">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'ml-auto bg-indigo-500/30 text-indigo-50 border border-indigo-400/30'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/50'
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>

            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => send(chip)}
                  className="text-xs rounded-full border border-slate-600 bg-slate-950/60 text-slate-300 px-3 py-1.5 hover:border-indigo-400/50 hover:text-indigo-100 transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            <form
              className="flex items-center gap-2 px-4 py-3 border-t border-slate-700/60 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about naps, bedtime, cues…"
                className="flex-1 rounded-2xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                type="submit"
                className="rounded-2xl bg-indigo-500 p-2.5 text-white hover:bg-indigo-400 transition"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
