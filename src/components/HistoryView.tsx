import { useMemo, useState } from 'react';
import { CalendarRange, Moon, Sun, AlertTriangle, CloudMoon } from 'lucide-react';
import type { DayHealthTag, HistoryDay } from '../types/sleep';
import { formatHistoryDateLabel } from '../utils/demoHistory';
import { formatMinutesToTime } from '../utils/scheduleEngine';

interface HistoryViewProps {
  days: HistoryDay[];
  babyName: string;
}

const HEALTH_META: Record<
  DayHealthTag,
  { label: string; short: string; chip: string; card: string }
> = {
  good: {
    label: 'On schedule',
    short: 'Good',
    chip: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
    card: 'border-emerald-500/35 bg-emerald-950/20',
  },
  sleepy: {
    label: 'Slept a lot',
    short: 'Sleepy',
    chip: 'bg-sky-500/20 text-sky-100 border-sky-400/40',
    card: 'border-sky-500/40 bg-sky-950/25',
  },
  active: {
    label: 'Too active / missed windows',
    short: 'Active',
    chip: 'bg-rose-500/20 text-rose-100 border-rose-400/40',
    card: 'border-rose-500/45 bg-rose-950/25',
  },
};

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Compact day strip: indigo = sleep, amber = awake across the day window. */
function DayRhythmBar({ day }: { day: HistoryDay }) {
  const start = day.segments[0]?.startMinutes ?? 7 * 60;
  const end = day.segments[day.segments.length - 1]?.endMinutes ?? 20 * 60;
  const span = Math.max(1, end - start);

  return (
    <div
      className="mt-3 h-3 w-full rounded-full bg-slate-800/80 overflow-hidden flex"
      role="img"
      aria-label="Sleep and awake rhythm strip"
    >
      {day.segments.map((seg, i) => {
        const width = (seg.durationMinutes / span) * 100;
        return (
          <span
            key={`${seg.type}-${seg.startMinutes}-${i}`}
            title={`${seg.label ?? seg.type}: ${formatDuration(seg.durationMinutes)}`}
            className={`h-full ${
              seg.type === 'sleep' ? 'bg-indigo-400/85' : 'bg-amber-400/70'
            }`}
            style={{ width: `${Math.max(width, 1.2)}%` }}
          />
        );
      })}
    </div>
  );
}

export function HistoryView({ days, babyName }: HistoryViewProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(days[0]?.dateKey ?? null);
  const [filter, setFilter] = useState<DayHealthTag | 'all'>('all');

  const counts = useMemo(() => {
    return days.reduce(
      (acc, d) => {
        acc[d.health] += 1;
        return acc;
      },
      { good: 0, sleepy: 0, active: 0 } as Record<DayHealthTag, number>,
    );
  }, [days]);

  const visible = useMemo(
    () => (filter === 'all' ? days : days.filter((d) => d.health === filter)),
    [days, filter],
  );

  const selected = visible.find((d) => d.dateKey === selectedKey) ?? visible[0] ?? null;

  return (
    <section className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5 space-y-4">
      <div className="flex items-start gap-2">
        <CalendarRange className="h-4 w-4 text-indigo-300 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Sleep History</h2>
          <p className="text-sm text-slate-400">
            {babyName}&apos;s sleep &amp; awake rhythm over the past few weeks
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['good', 'sleepy', 'active'] as DayHealthTag[]).map((tag) => {
          const meta = HEALTH_META[tag];
          const Icon = tag === 'good' ? Sun : tag === 'sleepy' ? CloudMoon : AlertTriangle;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setFilter((f) => (f === tag ? 'all' : tag))}
              className={`rounded-2xl border px-2.5 py-2.5 text-left transition ${
                filter === tag ? meta.card + ' ring-1 ring-white/10' : 'border-slate-700/60 bg-slate-950/40'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3.5 w-3.5 text-slate-300" />
                <span className="text-[11px] font-medium text-slate-200">{meta.short}</span>
              </div>
              <p className="text-lg font-semibold tabular-nums text-slate-50">{counts[tag]}</p>
              <p className="text-[10px] text-slate-500 leading-snug">{meta.label}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-indigo-400" /> Sleep
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Awake
        </span>
        <span className="text-slate-600">·</span>
        <span>Problem days are color-tagged</span>
      </div>

      <ol className="space-y-2 max-h-[22rem] overflow-y-auto pr-0.5">
        {visible.map((day) => {
          const meta = HEALTH_META[day.health];
          const isSelected = selected?.dateKey === day.dateKey;
          return (
            <li key={day.dateKey}>
              <button
                type="button"
                onClick={() => setSelectedKey(day.dateKey)}
                className={`w-full text-left rounded-2xl border px-3.5 py-3 transition ${
                  isSelected ? meta.card : 'border-slate-700/50 bg-slate-950/40 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-100">
                      {formatHistoryDateLabel(day.dateKey)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {day.napCount} nap{day.napCount === 1 ? '' : 's'} · sleep{' '}
                      {formatDuration(day.totalSleepMinutes)} · longest wake{' '}
                      {formatDuration(day.longestWakeMinutes)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.chip}`}
                  >
                    {meta.short}
                  </span>
                </div>
                <DayRhythmBar day={day} />
              </button>
            </li>
          );
        })}
      </ol>

      {selected && (
        <article className={`rounded-2xl border p-4 ${HEALTH_META[selected.health].card}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-medium text-slate-50">
              {formatHistoryDateLabel(selected.dateKey)}
            </h3>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              {selected.source === 'logged' ? 'From your logs' : 'Demo history'}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-3">{selected.summary}</p>
          <ul className="space-y-1.5">
            {selected.segments.map((seg, i) => (
              <li
                key={`${seg.type}-${seg.startMinutes}-${i}`}
                className="flex items-center justify-between gap-2 text-xs rounded-xl bg-slate-950/50 border border-slate-700/40 px-3 py-2"
              >
                <span className="inline-flex items-center gap-1.5 text-slate-200">
                  {seg.type === 'sleep' ? (
                    <Moon className="h-3.5 w-3.5 text-indigo-300" />
                  ) : (
                    <Sun className="h-3.5 w-3.5 text-amber-300" />
                  )}
                  {seg.label ?? (seg.type === 'sleep' ? 'Sleep' : 'Awake')}
                </span>
                <span className="text-slate-400 tabular-nums shrink-0">
                  {formatMinutesToTime(seg.startMinutes)} · {formatDuration(seg.durationMinutes)}
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}

      {visible.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-6">No days match this filter.</p>
      )}
    </section>
  );
}
