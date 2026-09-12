import { Moon, AlertTriangle, Sparkles, Wind, Baby } from 'lucide-react';
import type { DailyRhythmState, RhythmPhase } from '../types/sleep';

interface CountdownHeroProps {
  rhythm: DailyRhythmState;
  babyAgeWeeks: number;
  babyName?: string;
}

const PHASE_STYLES: Record<
  RhythmPhase,
  { badge: string; ring: string; glow: string; icon: typeof Moon }
> = {
  AWAKE_ACTIVE: {
    badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
    ring: 'stroke-emerald-400',
    glow: 'from-emerald-500/20 to-slate-900',
    icon: Baby,
  },
  WIND_DOWN: {
    badge: 'bg-indigo-500/25 text-indigo-200 border-indigo-400/40',
    ring: 'stroke-indigo-400',
    glow: 'from-indigo-500/25 to-slate-900',
    icon: Wind,
  },
  SWEET_SPOT: {
    badge: 'bg-amber-500/25 text-amber-100 border-amber-400/40',
    ring: 'stroke-amber-400',
    glow: 'from-amber-500/20 to-slate-900',
    icon: Sparkles,
  },
  OVERTIRED: {
    badge: 'bg-rose-500/25 text-rose-100 border-rose-400/40',
    ring: 'stroke-rose-400',
    glow: 'from-rose-500/20 to-slate-900',
    icon: AlertTriangle,
  },
  NAPPING: {
    badge: 'bg-slate-500/30 text-slate-200 border-slate-400/30',
    ring: 'stroke-slate-300',
    glow: 'from-slate-500/20 to-slate-900',
    icon: Moon,
  },
};

const PHASE_BADGE_LABEL: Record<RhythmPhase, string> = {
  AWAKE_ACTIVE: 'Active Awake',
  WIND_DOWN: 'Active Wind-Down',
  SWEET_SPOT: 'Optimal Sleep Window',
  OVERTIRED: 'Cortisol Spike Alert',
  NAPPING: 'Currently Napping',
};

export function CountdownHero({ rhythm, babyAgeWeeks, babyName }: CountdownHeroProps) {
  const style = PHASE_STYLES[rhythm.currentPhase];
  const Icon = style.icon;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rhythm.progressPercent / 100) * circumference;

  const countdownLabel =
    rhythm.currentPhase === 'NAPPING'
      ? 'Protecting nap'
      : rhythm.currentPhase === 'SWEET_SPOT'
        ? rhythm.remainingMinutesToSweetSpot <= 0
          ? 'Sweet spot now'
          : `${rhythm.remainingMinutesToSweetSpot} mins to Sweet Spot`
        : rhythm.currentPhase === 'OVERTIRED'
          ? `${rhythm.elapsedAwakeMinutes}m awake — past window`
          : `${rhythm.remainingMinutesToSweetSpot} mins to Sweet Spot`;

  return (
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-b ${style.glow} border border-slate-700/60 p-5 shadow-xl`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_55%)] pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-1">RhythmShift</p>
          <h1 className="text-xl font-semibold text-slate-50 leading-tight">
            {rhythm.headline}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {babyName ? `${babyName} · ` : ''}
            {babyAgeWeeks}-week-old · wake window tracking
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${style.badge}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {rhythm.badgeLabel ?? PHASE_BADGE_LABEL[rhythm.currentPhase]}
        </span>
      </div>

      <div className="relative flex flex-col items-center py-4">
        <div className="relative h-36 w-36">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-slate-800"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={`${style.ring} transition-all duration-700 ease-out`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
            <span className="text-3xl font-semibold tabular-nums text-slate-50">
              {rhythm.progressPercent}%
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">wake pressure</span>
          </div>
        </div>

        <p className="mt-3 text-lg font-medium text-slate-100">{countdownLabel}</p>
        <p className="mt-1 text-sm text-slate-400 text-center max-w-xs leading-relaxed">
          {rhythm.activeGuidance}
        </p>
      </div>

      <div className="relative mt-2 rounded-2xl bg-slate-950/40 border border-slate-700/50 px-4 py-3">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Look for</p>
        <ul className="flex flex-wrap gap-2">
          {rhythm.cuesToWatch.map((cue) => (
            <li
              key={cue}
              className="rounded-full bg-slate-800/80 text-slate-300 text-xs px-3 py-1 border border-slate-700/60"
            >
              {cue}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
