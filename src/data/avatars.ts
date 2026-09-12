import type { BabyAvatar, BabyAvatarId } from '../types/sleep';

/** 3 boys + 3 girls across light, medium, and deep skin tones. */
export const BABY_AVATARS: BabyAvatar[] = [
  {
    id: 'boy-fair',
    label: 'Boy · Fair',
    emoji: '👦🏻',
    accent: 'from-sky-400/35 to-slate-800',
    ring: 'ring-sky-300',
  },
  {
    id: 'boy-medium',
    label: 'Boy · Medium',
    emoji: '👦🏽',
    accent: 'from-teal-400/35 to-slate-800',
    ring: 'ring-teal-300',
  },
  {
    id: 'boy-deep',
    label: 'Boy · Deep',
    emoji: '👦🏿',
    accent: 'from-indigo-400/35 to-slate-800',
    ring: 'ring-indigo-300',
  },
  {
    id: 'girl-fair',
    label: 'Girl · Fair',
    emoji: '👧🏻',
    accent: 'from-rose-300/35 to-slate-800',
    ring: 'ring-rose-300',
  },
  {
    id: 'girl-medium',
    label: 'Girl · Medium',
    emoji: '👧🏽',
    accent: 'from-fuchsia-400/30 to-slate-800',
    ring: 'ring-fuchsia-300',
  },
  {
    id: 'girl-deep',
    label: 'Girl · Deep',
    emoji: '👧🏿',
    accent: 'from-amber-400/35 to-slate-800',
    ring: 'ring-amber-300',
  },
];

export function getAvatarById(id: string): BabyAvatar {
  return BABY_AVATARS.find((a) => a.id === id) ?? BABY_AVATARS[0];
}

export function isBabyAvatarId(id: string): id is BabyAvatarId {
  return BABY_AVATARS.some((a) => a.id === id);
}
