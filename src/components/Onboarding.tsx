import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Baby } from 'lucide-react';
import { BABY_AVATARS, isBabyAvatarId } from '../data/avatars';
import type { BabyAvatarId, BabyProfile } from '../types/sleep';
import {
  calculateAgeWeeks,
  formatAgeLabel,
  isValidDateOfBirth,
  todayIsoDate,
} from '../utils/babyAge';
import { buildProfileFromOnboarding } from '../utils/profileStorage';

interface OnboardingProps {
  onComplete: (profile: BabyProfile) => void;
  initial?: Partial<Pick<BabyProfile, 'name' | 'dateOfBirth' | 'avatarId'>>;
}

export function Onboarding({ onComplete, initial }: OnboardingProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? '');
  const [avatarId, setAvatarId] = useState<BabyAvatarId>(
    initial?.avatarId && isBabyAvatarId(initial.avatarId)
      ? initial.avatarId
      : 'boy-fair',
  );
  const [touched, setTouched] = useState(false);

  const ageWeeks = useMemo(
    () => (dateOfBirth ? calculateAgeWeeks(dateOfBirth) : null),
    [dateOfBirth],
  );

  const nameOk = name.trim().length >= 1;
  const dobOk = Boolean(dateOfBirth) && isValidDateOfBirth(dateOfBirth);
  const canSubmit = nameOk && dobOk;

  const errorMessage = (() => {
    if (!touched) return null;
    if (!nameOk) return 'Please enter your baby’s name.';
    if (!dateOfBirth) return 'Please enter a date of birth.';
    if (!dobOk) return 'Date of birth must be today or earlier (up to ~2 years ago).';
    return null;
  })();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onComplete(
      buildProfileFromOnboarding({
        name,
        dateOfBirth,
        avatarId,
      }),
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-md mx-auto min-h-screen px-4 py-8 flex flex-col">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.25em] text-indigo-300/80 mb-2">
            Welcome to RhythmShift
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            Meet your little one
          </h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            We’ll tailor wake windows and nap projections from their age. You can
            change this later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6">
          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-wider text-slate-500">
              Baby’s name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nora"
              autoComplete="off"
              maxLength={40}
              className="w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-wider text-slate-500">
              Date of birth
            </span>
            <input
              type="date"
              value={dateOfBirth}
              max={todayIsoDate()}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 [color-scheme:dark]"
            />
            {ageWeeks !== null && dobOk && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-200/90">
                <Baby className="h-3.5 w-3.5" />
                {formatAgeLabel(ageWeeks)} — wake windows will match this stage
              </p>
            )}
          </label>

          <fieldset className="space-y-3">
            <legend className="text-xs uppercase tracking-wider text-slate-500">
              Choose an avatar
            </legend>
            <div className="grid grid-cols-3 gap-2.5">
              {BABY_AVATARS.map((avatar) => {
                const selected = avatar.id === avatarId;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setAvatarId(avatar.id)}
                    aria-pressed={selected}
                    className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition ${
                      selected
                        ? `border-transparent ring-2 ${avatar.ring} bg-gradient-to-b ${avatar.accent}`
                        : 'border-slate-700/70 bg-slate-950/60 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-2xl" aria-hidden>
                      {avatar.emoji}
                    </span>
                    <span className="text-[11px] text-slate-300">{avatar.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {errorMessage && (
            <p className="text-sm text-rose-300" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="mt-auto pt-4">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-400 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-500"
            >
              Start RhythmShift
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
