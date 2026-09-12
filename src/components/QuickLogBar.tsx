import { Baby, Mic, MicOff, Moon, Utensils, X } from 'lucide-react';
import type { EventType } from '../types/sleep';
import { formatLagLabel } from '../utils/voiceEventParser';

interface QuickLogBarProps {
  isListening: boolean;
  isSupported: boolean;
  interimTranscript?: string;
  finalTranscript?: string;
  parsedType?: EventType | null;
  minutesAgo?: number;
  error?: string | null;
  onToggleListen: () => void;
  onQuickLog: (kind: 'WAKE' | 'NAP_START' | 'FEED') => void;
  onDismissError?: () => void;
  onDismissTranscript?: () => void;
}

const EVENT_LABEL: Partial<Record<EventType, string>> = {
  WAKE: 'Baby woke up',
  NAP_START: 'Fell asleep',
  NAP_END: 'Nap ended',
  FEED: 'Feed',
  TIRED_CUE: 'Tired cue',
  NOTE: 'Note',
};

export function QuickLogBar({
  isListening,
  isSupported,
  interimTranscript,
  finalTranscript,
  parsedType,
  minutesAgo = 0,
  error,
  onToggleListen,
  onQuickLog,
  onDismissError,
  onDismissTranscript,
}: QuickLogBarProps) {
  const liveText = interimTranscript?.trim() ?? '';
  const finalText = finalTranscript?.trim() ?? '';
  const showLive = Boolean(isListening && (liveText || !finalText));
  const showFinal = Boolean(finalText && !error);
  const lagLabel = formatLagLabel(minutesAgo);

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md px-3 pb-3">
        {error && (
          <div className="mb-2 flex items-start gap-2 rounded-2xl border border-rose-400/40 bg-rose-950/90 px-3 py-2 text-xs text-rose-100 shadow-lg">
            <p className="flex-1 leading-relaxed">{error}</p>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="shrink-0 rounded-full p-0.5 text-rose-200/80 hover:text-white"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {(showLive || showFinal) && !error && (
          <div
            className={`mb-2 rounded-2xl border px-3 py-2.5 shadow-lg ${
              isListening
                ? 'border-rose-400/40 bg-slate-950/95'
                : 'border-emerald-400/35 bg-slate-950/95'
            }`}
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {isListening && liveText
                  ? 'Hearing now'
                  : isListening
                    ? 'Listening'
                    : 'Recognized'}
              </p>
              <div className="flex items-center gap-2">
                {showFinal && lagLabel && (
                  <span className="text-[10px] rounded-full bg-amber-500/20 text-amber-100 border border-amber-400/30 px-2 py-0.5">
                    {lagLabel}
                  </span>
                )}
                {showFinal && parsedType && (
                  <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-100 border border-emerald-400/30 px-2 py-0.5">
                    → {EVENT_LABEL[parsedType] ?? parsedType}
                  </span>
                )}
                {showFinal && !isListening && onDismissTranscript && (
                  <button
                    type="button"
                    onClick={onDismissTranscript}
                    className="rounded-full p-0.5 text-slate-500 hover:text-slate-200"
                    aria-label="Dismiss transcript"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p
              className={`text-sm leading-relaxed ${
                isListening && liveText ? 'text-indigo-100 italic' : 'text-slate-100'
              }`}
            >
              {isListening && liveText
                ? `“${liveText}”`
                : showFinal
                  ? `“${finalText}”`
                  : 'Speak clearly… try “baby woke up” or “fed”'}
            </p>
            {isListening && liveText && (
              <p className="mt-1 text-[10px] text-slate-500">
                Live draft — final text appears when you pause. Tip: “woke up 10 minutes ago”
              </p>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-3xl border border-slate-700/70 bg-slate-950/95 backdrop-blur-md px-3 py-3 shadow-2xl shadow-black/40">
          <button
            type="button"
            onClick={() => onQuickLog('WAKE')}
            className="flex-1 flex flex-col items-center gap-1 rounded-2xl bg-emerald-500/15 border border-emerald-400/25 py-2.5 text-emerald-100 hover:bg-emerald-500/25 transition"
          >
            <Baby className="h-4 w-4" />
            <span className="text-[10px] font-medium leading-tight text-center px-1">
              + Baby Woke Up
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleListen}
            aria-pressed={isListening}
            aria-label={isListening ? 'Stop dictation' : 'Start dictation'}
            className={`relative -mt-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 transition shadow-lg ${
              isListening
                ? 'bg-rose-500 border-rose-300 text-white shadow-rose-500/40'
                : isSupported
                  ? 'bg-indigo-500 border-indigo-300 text-white shadow-indigo-500/30 hover:bg-indigo-400'
                  : 'bg-slate-700 border-slate-500 text-slate-300'
            }`}
          >
            {isListening && (
              <span className="absolute inset-0 rounded-full animate-ping bg-rose-400/40" />
            )}
            {isListening ? (
              <MicOff className="relative h-6 w-6" />
            ) : (
              <Mic className="relative h-6 w-6" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onQuickLog('NAP_START')}
            className="flex-1 flex flex-col items-center gap-1 rounded-2xl bg-indigo-500/15 border border-indigo-400/25 py-2.5 text-indigo-100 hover:bg-indigo-500/25 transition"
          >
            <Moon className="h-4 w-4" />
            <span className="text-[10px] font-medium leading-tight text-center px-1">
              + Fell Asleep
            </span>
          </button>

          <button
            type="button"
            onClick={() => onQuickLog('FEED')}
            className="flex-1 flex flex-col items-center gap-1 rounded-2xl bg-amber-500/15 border border-amber-400/25 py-2.5 text-amber-100 hover:bg-amber-500/25 transition"
          >
            <Utensils className="h-4 w-4" />
            <span className="text-[10px] font-medium leading-tight text-center px-1">
              + Fed
            </span>
          </button>
        </div>
        {!isSupported && (
          <p className="mt-1.5 text-center text-[10px] text-slate-500">
            Voice dictation unavailable — use quick buttons or text in the chat
          </p>
        )}
      </div>
    </div>
  );
}
