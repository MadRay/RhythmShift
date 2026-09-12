import type { BabyProfile } from '../types/sleep';
import { getAvatarById, isBabyAvatarId } from '../data/avatars';
import { calculateAgeWeeks } from './babyAge';
import { getWakeWindowForAge } from './scheduleEngine';

const STORAGE_KEY = 'rhythmshift.babyProfile';

export function loadBabyProfile(): BabyProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BabyProfile;
    if (!parsed?.name || !parsed?.dateOfBirth || !parsed?.avatarId) return null;

    const ageWeeks = calculateAgeWeeks(parsed.dateOfBirth);
    const range = getWakeWindowForAge(ageWeeks);
    const avatarId = isBabyAvatarId(parsed.avatarId)
      ? parsed.avatarId
      : getAvatarById(parsed.avatarId).id;
    return {
      ...parsed,
      avatarId,
      ageWeeks,
      defaultWakeWindowMinutes: range.sweetSpot,
      morningWakeTime: parsed.morningWakeTime || '07:00 AM',
      targetBedtime: parsed.targetBedtime || '07:30 PM',
    };
  } catch {
    return null;
  }
}

export function saveBabyProfile(profile: BabyProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearBabyProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function buildProfileFromOnboarding(input: {
  name: string;
  dateOfBirth: string;
  avatarId: BabyProfile['avatarId'];
}): BabyProfile {
  const ageWeeks = calculateAgeWeeks(input.dateOfBirth);
  const range = getWakeWindowForAge(ageWeeks);
  return {
    name: input.name.trim(),
    dateOfBirth: input.dateOfBirth,
    avatarId: input.avatarId,
    ageWeeks,
    morningWakeTime: '07:00 AM',
    targetBedtime: '07:30 PM',
    defaultWakeWindowMinutes: range.sweetSpot,
  };
}
