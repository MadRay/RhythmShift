import { FlaskConical, RotateCcw, Sunrise, Sparkles, AlertOctagon, AlertTriangle } from 'lucide-react';

export type DemoAction =
  | 'fresh-morning'
  | 'sweet-spot'
  | 'short-nap'
  | 'long-awake'
  | 'reset';

interface DemoToolbarProps {
  onAction: (action: DemoAction) => void;
}

const ACTIONS: Array<{
  id: DemoAction;
  label: string;
  icon: typeof Sunrise;
  tone: string;
}> = [
  {
    id: 'fresh-morning',
    label: 'Fresh Morning Wake (0m elapsed)',
    icon: Sunrise,
    tone: 'hover:border-emerald-400/50 hover:text-emerald-200',
  },
  {
    id: 'sweet-spot',
    label: 'Sweet Spot — Put Down Now',
    icon: Sparkles,
    tone: 'hover:border-amber-400/50 hover:text-amber-200',
  },
  {
    id: 'short-nap',
    label: 'Short Nap Disaster (Nap was only 22m)',
    icon: AlertOctagon,
    tone: 'hover:border-rose-400/50 hover:text-rose-200',
  },
  {
    id: 'long-awake',
    label: 'Critical Overwake (3h awake)',
    icon: AlertTriangle,
    tone: 'hover:border-rose-500/60 hover:text-rose-100',
  },
  {
    id: 'reset',
    label: 'Reset All to Baseline',
    icon: RotateCcw,
    tone: 'hover:border-amber-400/50 hover:text-amber-200',
  },
];

export function DemoToolbar({ onAction }: DemoToolbarProps) {
  return (
    <aside className="fixed bottom-28 right-3 z-30 w-[min(100%-1.5rem,15.5rem)]">
      <div className="rounded-2xl border border-slate-600/70 bg-slate-950/95 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/60 bg-slate-900/80">
          <FlaskConical className="h-3.5 w-3.5 text-amber-300" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Demo Controls
          </span>
        </div>
        <ul className="p-1.5 space-y-1">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={() => onAction(action.id)}
                  className={`w-full flex items-start gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left text-[11px] leading-snug text-slate-400 transition ${action.tone}`}
                >
                  <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{action.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
