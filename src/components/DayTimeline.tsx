import { useEffect, useRef, useState } from 'react';
import { Bed, ChevronDown, ChevronUp, Coffee, Moon, Wind } from 'lucide-react';
import type { ScheduleBlock } from '../types/sleep';

interface DayTimelineProps {
  schedule: ScheduleBlock[];
  nowLabel?: string;
  onNapEndedEarly?: (blockId: string) => void;
  onSleptInStroller?: (blockId: string) => void;
  onMarkComplete?: (blockId: string) => void;
}

const TYPE_META: Record<
  ScheduleBlock['type'],
  { icon: typeof Moon; accent: string; dot: string }
> = {
  wake: { icon: Coffee, accent: 'border-emerald-500/40', dot: 'bg-emerald-400' },
  nap: { icon: Moon, accent: 'border-indigo-500/40', dot: 'bg-indigo-400' },
  wind_down: { icon: Wind, accent: 'border-amber-500/40', dot: 'bg-amber-400' },
  bedtime: { icon: Bed, accent: 'border-rose-400/40', dot: 'bg-rose-400' },
};

const STATUS_LABEL: Record<ScheduleBlock['status'], string> = {
  completed: 'Passed',
  active: 'Now',
  projected: 'Planned',
};

export function DayTimeline({
  schedule,
  nowLabel,
  onNapEndedEarly,
  onSleptInStroller,
  onMarkComplete,
}: DayTimelineProps) {
  const [showPassed, setShowPassed] = useState(false);
  const activeRef = useRef<HTMLLIElement | null>(null);

  const passed = schedule.filter((b) => b.status === 'completed');
  const focusBlocks = schedule.filter((b) => b.status !== 'completed');
  const visible = showPassed ? schedule : focusBlocks;
  const passedCount = passed.length;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [schedule, showPassed]);

  return (
    <section className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Today&apos;s Timeline</h2>
          <p className="text-sm text-slate-400">
            {nowLabel ? `Synced to ${nowLabel}` : 'Clock-synced rhythm'}
            {!showPassed && passedCount > 0
              ? ` · ${passedCount} hidden`
              : passedCount > 0
                ? ` · ${passedCount} passed`
                : ''}
          </p>
        </div>
      </div>

      {passedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowPassed((v) => !v)}
          className="mb-4 w-full flex items-center justify-between gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/50 px-3.5 py-2.5 text-left text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100 transition"
          aria-expanded={showPassed}
        >
          <span>
            {showPassed
              ? 'Hide passed events'
              : `Show ${passedCount} passed event${passedCount === 1 ? '' : 's'}`}
          </span>
          {showPassed ? (
            <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          )}
        </button>
      )}

      <ol className="relative space-y-0">
        {visible.map((block, index) => {
          const meta = TYPE_META[block.type];
          const Icon = meta.icon;
          const isLast = index === visible.length - 1;
          const isPassed = block.status === 'completed';
          const isActive = block.status === 'active';
          const isAlert = Boolean(block.isAlert);
          const isFirstFocus = focusBlocks[0]?.id === block.id;

          return (
            <li
              key={block.id}
              ref={isActive ? activeRef : undefined}
              className={`relative flex gap-3 pb-5 transition-opacity ${
                isPassed ? 'opacity-45' : 'opacity-100'
              }`}
            >
              {!isLast && (
                <span
                  className={`absolute left-[15px] top-8 bottom-0 w-px ${
                    isPassed ? 'bg-slate-700/50' : isAlert ? 'bg-rose-700/50' : 'bg-slate-700/80'
                  }`}
                />
              )}
              <div
                className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-slate-950 ${
                  isActive && isAlert
                    ? 'border-rose-400 ring-2 ring-rose-400/40'
                    : isActive
                      ? 'border-indigo-400 ring-2 ring-indigo-400/30'
                      : isAlert
                        ? 'border-rose-400/50'
                        : meta.accent
                }`}
              >
                <span
                  className={`absolute -left-0 h-2 w-2 rounded-full ${
                    isActive && isAlert
                      ? 'bg-rose-300'
                      : isActive
                        ? 'bg-indigo-300'
                        : isAlert
                          ? 'bg-rose-400'
                          : meta.dot
                  } ${isPassed ? 'opacity-40' : 'opacity-80'}`}
                />
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isPassed ? 'text-slate-500' : isAlert ? 'text-rose-200' : 'text-slate-200'
                  }`}
                />
              </div>

              <div
                className={`flex-1 rounded-2xl border px-3.5 py-3 transition-colors ${
                  isActive && isAlert
                    ? 'border-rose-400/60 bg-rose-500/15 shadow-lg shadow-rose-950/40'
                    : isActive
                      ? 'border-indigo-400/50 bg-indigo-500/10 shadow-lg shadow-indigo-950/30'
                      : isPassed
                        ? 'border-slate-800/80 bg-slate-950/20'
                        : isAlert
                          ? 'border-rose-500/40 bg-rose-950/30'
                          : isFirstFocus
                            ? 'border-slate-600/60 bg-slate-950/50'
                            : 'border-slate-700/50 bg-slate-950/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={`font-medium ${
                        isPassed
                          ? 'text-slate-400 line-through decoration-slate-600'
                          : isAlert
                            ? 'text-rose-50'
                            : 'text-slate-100'
                      }`}
                    >
                      {block.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {block.startTime} – {block.endTime} · {block.durationMinutes}m
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isActive && isAlert
                          ? 'bg-rose-500/35 text-rose-100'
                          : isActive
                            ? 'bg-indigo-500/30 text-indigo-200'
                            : isPassed
                              ? 'bg-slate-800/80 text-slate-500'
                              : 'bg-emerald-500/15 text-emerald-200/90'
                      }`}
                    >
                      {STATUS_LABEL[block.status]}
                    </span>
                    {block.isAlert && !isPassed && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-100 border border-rose-400/40">
                        Alert
                      </span>
                    )}
                    {block.isAdjusted && !block.isAlert && !isPassed && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30">
                        Adjusted
                      </span>
                    )}
                  </div>
                </div>

                {block.adjustmentReason && !isPassed && (
                  <p
                    className={`mt-2 text-xs leading-relaxed border-l-2 pl-2 ${
                      isAlert
                        ? 'text-rose-100/95 border-rose-400/50'
                        : 'text-amber-200/90 border-amber-400/40'
                    }`}
                  >
                    {block.adjustmentReason}
                  </p>
                )}

                {isActive && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {block.type === 'nap' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onNapEndedEarly?.(block.id)}
                          className="text-xs rounded-full bg-rose-500/20 text-rose-100 border border-rose-400/30 px-3 py-1.5 hover:bg-rose-500/30 transition"
                        >
                          Nap Ended Early
                        </button>
                        <button
                          type="button"
                          onClick={() => onSleptInStroller?.(block.id)}
                          className="text-xs rounded-full bg-emerald-500/20 text-emerald-100 border border-emerald-400/30 px-3 py-1.5 hover:bg-emerald-500/30 transition"
                        >
                          Slept in Stroller
                        </button>
                      </>
                    )}
                    {block.type === 'wake' && (
                      <button
                        type="button"
                        onClick={() => onMarkComplete?.(block.id)}
                        className="text-xs rounded-full bg-indigo-500/25 text-indigo-100 border border-indigo-400/30 px-3 py-1.5 hover:bg-indigo-500/35 transition"
                      >
                        Start Nap Now
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {visible.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-4">
          No upcoming blocks left for today.
        </p>
      )}
    </section>
  );
}
