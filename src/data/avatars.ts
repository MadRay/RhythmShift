import type { BabyAvatar, BabyAvatarId } from '../types/sleep';

export const BABY_AVATARS: BabyAvatar[] = [
  {
    id: 'moonbeam',
    label: 'Moonbeam',
    emoji: '🌙',
    accent: 'from-indigo-500/40 to-slate-800',
    ring: 'ring-indigo-400',
  },
  {
    id: 'cloud',
    label: 'Cloud',
    emoji: '☁️',
    accent: 'from-slate-400/30 to-slate-800',
    ring: 'ring-slate-300',
  },
  {
    id: 'starling',
    label: 'Starling',
    emoji: '⭐',
    accent: 'from-amber-400/35 to-slate-800',
    ring: 'ring-amber-300',
  },
  {
    id: 'lamb',
    label: 'Lamb',
    emoji: '🐑',
    accent: 'from-emerald-400/30 to-slate-800',
    ring: 'ring-emerald-300',
  },
  {
    id: 'bunny',
    label: 'Bunny',
    emoji: '🐰',
    accent: 'from-rose-400/30 to-slate-800',
    ring: 'ring-rose-300',
  },
  {
    id: 'otter',
    label: 'Otter',
    emoji: '🦦',
    accent: 'from-teal-400/30 to-slate-800',
    ring: 'ring-teal-300',
  },
];

export function getAvatarById(id: BabyAvatarId): BabyAvatar {
  return BABY_AVATARS.find((a) => a.id === id) ?? BABY_AVATARS[0];
}
