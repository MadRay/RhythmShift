import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { CountdownHero } from './components/CountdownHero';
import { DayTimeline } from './components/DayTimeline';
import { MultiDayForecast } from './components/MultiDayForecast';
import { QuickLogBar } from './components/QuickLogBar';
import { SleepConsultantChat } from './components/SleepConsultantChat';
import { DemoToolbar, type DemoAction } from './components/DemoToolbar';
import { Onboarding } from './components/Onboarding';
import {
  useVoiceLogger,
  formatLagLabel,
  type ParsedVoiceEvent,
} from './hooks/useVoiceLogger';
import { getAvatarById } from './data/avatars';
import { formatAgeLabel } from './utils/babyAge';
import {
  loadBabyProfile,
  saveBabyProfile,
} from './utils/profileStorage';
import {
  computeDailyRhythmState,
  formatMinutesToTime,
  getNowMinutes,
  getWakeWindowForAge,
  parseTimeToMinutes,
  projectMultiDayRhythm,
} from './utils/scheduleEngine';
import type { BabyProfile, EventType, LoggedEvent, ScheduleBlock } from './types/sleep';

function createEvent(
  type: EventType,
  notes: string,
  detectedCues: string[] = [],
  durationMinutes?: number,
  timestamp: number = Date.now(),
  minutesAgo: number = 0,
): LoggedEvent {
  return {
    id: `evt-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp,
    type,
    notes,
    detectedCues,
    durationMinutes,
    minutesAgo,
  };
}

/** Build a Date today at HH:MM from schedule time string. */
function timestampAtTodayTime(time: string): number {
  const mins = parseTimeToMinutes(time);
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.getTime();
}

function seedEventsFromSchedule(
  profile: BabyProfile,
  schedule: ScheduleBlock[],
): LoggedEvent[] {
  const seeded: LoggedEvent[] = [];
  const morning = profile.morningWakeTime;

  seeded.push(
    createEvent(
      'WAKE',
      `Morning wake — ${profile.name}`,
      [],
      undefined,
      timestampAtTodayTime(morning),
    ),
  );
  seeded.push(
    createEvent(
      'FEED',
      'Fed after morning wake',
      [],
      undefined,
      timestampAtTodayTime(morning) + 12 * 60 * 1000,
    ),
  );

  for (const block of schedule) {
    if (block.status !== 'completed') continue;
    if (block.type === 'nap') {
      seeded.push(
        createEvent(
          'NAP_START',
          `${block.title} started`,
          [],
          undefined,
          timestampAtTodayTime(block.startTime),
        ),
      );
      seeded.push(
        createEvent(
          'NAP_END',
          `${block.title} ended`,
          [],
          block.durationMinutes,
          timestampAtTodayTime(block.endTime),
        ),
      );
    } else if (block.type === 'wake' && block.id !== 'wake-0') {
      seeded.push(
        createEvent(
          'WAKE',
          `${block.title} in progress earlier`,
          [],
          undefined,
          timestampAtTodayTime(block.startTime),
        ),
      );
    }
  }

  return seeded.sort((a, b) => b.timestamp - a.timestamp);
}

export default function App() {
  const [profile, setProfile] = useState<BabyProfile | null>(() => loadBabyProfile());
  const [editingProfile, setEditingProfile] = useState(false);
  const [clockNow, setClockNow] = useState(() => getNowMinutes());
  /** Demo toolbar can freeze the day clock; null = live. */
  const [nowOverride, setNowOverride] = useState<number | null>(null);
  const [lastNapDurationMinutes, setLastNapDurationMinutes] = useState<number | undefined>(
    undefined,
  );
  const [isNapping, setIsNapping] = useState(false);
  /** When set, hero/predictions use elapsed time since this wake moment (supports lagged logs). */
  const [wakeAnchorAt, setWakeAnchorAt] = useState<number | null>(null);
  const [events, setEvents] = useState<LoggedEvent[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'forecast'>('today');

  const effectiveNow = nowOverride ?? clockNow;

  useEffect(() => {
    const tick = () => setClockNow(getNowMinutes());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const rhythm = useMemo(() => {
    if (!profile) return null;
    const anchoredElapsed =
      wakeAnchorAt !== null && !isNapping
        ? Math.max(0, Math.round((Date.now() - wakeAnchorAt) / 60_000))
        : undefined;
    return computeDailyRhythmState({
      profile,
      nowMinutes: effectiveNow,
      lastNapDurationMinutes,
      isNapping,
      ...(anchoredElapsed !== undefined ? { elapsedAwakeMinutes: anchoredElapsed } : {}),
    });
  }, [profile, effectiveNow, lastNapDurationMinutes, isNapping, wakeAnchorAt, clockNow]);

  // Seed / refresh day logs when profile is ready so logs match passed timeline blocks
  useEffect(() => {
    if (!profile || !rhythm) return;
    setEvents((prev) => {
      if (prev.length > 0) return prev;
      return seedEventsFromSchedule(profile, rhythm.schedule);
    });
  }, [profile, rhythm]);

  const handleOnboardingComplete = useCallback((next: BabyProfile) => {
    saveBabyProfile(next);
    setProfile(next);
    setEditingProfile(false);
    setNowOverride(null);
    setLastNapDurationMinutes(undefined);
    setIsNapping(false);
    setWakeAnchorAt(null);
    const preview = computeDailyRhythmState({
      profile: next,
      nowMinutes: getNowMinutes(),
    });
    setEvents(seedEventsFromSchedule(next, preview.schedule));
  }, []);

  const handleParsedVoice = useCallback(
    (parsed: ParsedVoiceEvent) => {
      const lag = parsed.minutesAgo ?? 0;
      const occurredAt = parsed.occurredAt ?? Date.now() - lag * 60_000;
      const event = createEvent(
        parsed.type,
        parsed.notes,
        parsed.detectedCues,
        parsed.durationMinutes,
        occurredAt,
        lag,
      );
      setEvents((prev) => [event, ...prev]);

      const lagSuffix = formatLagLabel(lag);
      const lagNote = lagSuffix ? ` · ${lagSuffix}` : '';

      switch (parsed.type) {
        case 'WAKE':
          setIsNapping(false);
          setNowOverride(null);
          setWakeAnchorAt(occurredAt);
          showToast(`Logged: Baby woke up${lagNote}`);
          break;
        case 'NAP_START':
          setIsNapping(true);
          showToast(`Logged: Fell asleep${lagNote}`);
          break;
        case 'NAP_END': {
          setIsNapping(false);
          setWakeAnchorAt(occurredAt);
          if (parsed.durationMinutes !== undefined) {
            setLastNapDurationMinutes(parsed.durationMinutes);
          }
          showToast(
            `Logged: Nap ended${lagNote}${
              parsed.durationMinutes !== undefined
                ? ` · ${parsed.durationMinutes}m nap`
                : ''
            }`,
          );
          break;
        }
        case 'FEED':
          showToast(`Logged: Feed${lagNote}`);
          break;
        case 'TIRED_CUE':
          showToast(`Tired cue: ${parsed.detectedCues.join(', ') || 'noted'}${lagNote}`);
          break;
        default:
          showToast(`Note saved${lagNote}`);
      }
    },
    [showToast],
  );

  const voice = useVoiceLogger({ onParsed: handleParsedVoice });

  const forecasts = useMemo(
    () => (profile ? projectMultiDayRhythm(profile, 3) : []),
    [profile],
  );

  const handleQuickLog = useCallback(
    (kind: 'WAKE' | 'NAP_START' | 'FEED') => {
      const labels = {
        WAKE: 'Baby woke up',
        NAP_START: 'Fell asleep',
        FEED: 'Fed',
      } as const;
      handleParsedVoice({
        type: kind,
        notes: labels[kind],
        detectedCues: [],
        confidence: 'high',
        minutesAgo: 0,
        occurredAt: Date.now(),
      });
    },
    [handleParsedVoice],
  );

  const handleDemo = useCallback(
    (action: DemoAction) => {
      if (!profile) return;
      const morning = parseTimeToMinutes(profile.morningWakeTime);
      const range = getWakeWindowForAge(profile.ageWeeks);

      switch (action) {
        case 'fresh-morning': {
          const demoNow = morning + 2;
          setNowOverride(demoNow);
          setLastNapDurationMinutes(undefined);
          setIsNapping(false);
          setWakeAnchorAt(Date.now());
          setEvents([
            createEvent(
              'WAKE',
              'Demo: Fresh morning wake (0m elapsed)',
              [],
              undefined,
              timestampAtTodayTime(formatMinutesToTime(demoNow)),
            ),
          ]);
          showToast('Demo: Fresh morning wake — clock set near 7:00');
          break;
        }
        case 'wind-down': {
          const demoNow = morning + 40;
          setNowOverride(demoNow);
          setLastNapDurationMinutes(undefined);
          setIsNapping(false);
          setWakeAnchorAt(Date.now() - 40 * 60_000);
          showToast('Demo: Wind-down approaching — 40m into morning window');
          break;
        }
        case 'short-nap': {
          // Just after a 22m first nap
          const demoNow = morning + range.sweetSpot + 22 + 18;
          setNowOverride(demoNow);
          setLastNapDurationMinutes(22);
          setIsNapping(false);
          setWakeAnchorAt(Date.now() - 18 * 60_000);
          setEvents((prev) => [
            createEvent(
              'NAP_END',
              'Demo: Short nap disaster — only 22m',
              [],
              22,
              timestampAtTodayTime(formatMinutesToTime(demoNow)),
              18,
            ),
            ...prev,
          ]);
          showToast('Demo: Short nap (22m) — schedule rerouted');
          break;
        }
        case 'reset': {
          setNowOverride(null);
          setLastNapDurationMinutes(undefined);
          setIsNapping(false);
          setWakeAnchorAt(null);
          const live = computeDailyRhythmState({
            profile,
            nowMinutes: getNowMinutes(),
          });
          setEvents(seedEventsFromSchedule(profile, live.schedule));
          showToast('Reset to live clock');
          break;
        }
      }
    },
    [profile, showToast],
  );

  const handleNapEndedEarly = useCallback(() => {
    setLastNapDurationMinutes(22);
    setIsNapping(false);
    setEvents((prev) => [
      createEvent('NAP_END', 'Nap ended early', [], 22),
      ...prev,
    ]);
    showToast('Nap ended early — next window shortened');
  }, [showToast]);

  const handleSleptInStroller = useCallback(() => {
    setEvents((prev) => [
      createEvent('NOTE', 'Slept in stroller — motion nap noted', ['Motion sleep']),
      ...prev,
    ]);
    showToast('Noted: slept in stroller');
  }, [showToast]);

  const handleStartNap = useCallback(() => {
    setIsNapping(true);
    setEvents((prev) => [createEvent('NAP_START', 'Started nap from timeline'), ...prev]);
    showToast('Nap started');
  }, [showToast]);

  if (!profile || editingProfile) {
    return (
      <Onboarding
        onComplete={handleOnboardingComplete}
        initial={profile ?? undefined}
      />
    );
  }

  if (!rhythm) return null;

  const avatar = getAvatarById(profile.avatarId);
  const wakeRange = getWakeWindowForAge(profile.ageWeeks);
  const nowLabel = formatMinutesToTime(effectiveNow);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-md mx-auto min-h-screen pb-28 px-4 pt-6 space-y-5 relative">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b ${avatar.accent} ring-2 ${avatar.ring} text-xl`}
              aria-hidden
            >
              {avatar.emoji}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.25em] text-indigo-300/80">
                RhythmShift
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-slate-50 truncate">
                {profile.name}
              </h1>
              <p className="text-xs text-slate-400">{formatAgeLabel(profile.ageWeeks)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <p className="text-xs text-slate-500">
              {wakeRange.min}–{wakeRange.max}m windows
            </p>
            <button
              type="button"
              onClick={() => setEditingProfile(true)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 hover:border-slate-500 transition"
            >
              <Pencil className="h-3 w-3" />
              Edit baby
            </button>
          </div>
        </header>

        <CountdownHero
          rhythm={rhythm}
          babyAgeWeeks={profile.ageWeeks}
          babyName={profile.name}
        />

        <div className="flex rounded-2xl border border-slate-700/60 bg-slate-950/50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
              activeTab === 'today'
                ? 'bg-slate-800 text-slate-50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('forecast')}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
              activeTab === 'forecast'
                ? 'bg-slate-800 text-slate-50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3-Day Forecast
          </button>
        </div>

        {activeTab === 'today' ? (
          <DayTimeline
            schedule={rhythm.schedule}
            nowLabel={nowLabel}
            onNapEndedEarly={handleNapEndedEarly}
            onSleptInStroller={handleSleptInStroller}
            onMarkComplete={handleStartNap}
          />
        ) : (
          <MultiDayForecast forecasts={forecasts} />
        )}

        {events.length > 0 && (
          <section className="rounded-3xl border border-slate-700/60 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h2 className="text-sm font-semibold text-slate-200">Recent logs</h2>
              <span className="text-[10px] text-slate-500">Aligned to today&apos;s schedule</span>
            </div>
            <ul className="space-y-2">
              {events.slice(0, 8).map((evt) => (
                <li
                  key={evt.id}
                  className="flex items-start justify-between gap-2 text-xs rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-2"
                >
                  <div>
                    <span className="font-medium text-indigo-200">{evt.type}</span>
                    {evt.minutesAgo !== undefined && evt.minutesAgo > 0 && (
                      <span className="ml-2 text-[10px] rounded-full bg-amber-500/15 text-amber-200/90 px-1.5 py-0.5">
                        logged {evt.minutesAgo}m late
                      </span>
                    )}
                    {evt.notes && (
                      <p className="text-slate-400 mt-0.5">{evt.notes}</p>
                    )}
                    {evt.detectedCues.length > 0 && (
                      <p className="text-amber-200/80 mt-0.5">
                        Cues: {evt.detectedCues.join(', ')}
                      </p>
                    )}
                  </div>
                  <time className="text-slate-500 shrink-0 tabular-nums">
                    {new Date(evt.timestamp).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <QuickLogBar
        isListening={voice.isListening}
        isSupported={voice.isSupported}
        interimTranscript={voice.interimTranscript}
        finalTranscript={voice.transcript}
        parsedType={voice.lastParsed?.type ?? null}
        minutesAgo={voice.lastParsed?.minutesAgo ?? 0}
        error={voice.error}
        onToggleListen={() =>
          voice.isListening ? voice.stopListening() : voice.startListening()
        }
        onQuickLog={handleQuickLog}
        onDismissError={voice.clearError}
        onDismissTranscript={voice.clearTranscript}
      />

      <SleepConsultantChat
        profile={profile}
        rhythm={rhythm}
        lastNapDurationMinutes={lastNapDurationMinutes}
      />

      <DemoToolbar onAction={handleDemo} />

      {toast && (
        <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="max-w-md w-full rounded-2xl bg-slate-800/95 border border-slate-600 text-sm text-slate-100 px-4 py-2.5 shadow-lg text-center">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
