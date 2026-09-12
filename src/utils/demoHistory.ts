import type { BabyProfile, DayHealthTag, HistoryDay, HistorySegment } from '../types/sleep';
import { getWakeWindowForAge, parseTimeToMinutes } from './scheduleEngine';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatHistoryDateLabel(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const today = toDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === today) return 'Today';
  if (dateKey === toDateKey(yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function buildDayFromPattern(
  dateKey: string,
  health: DayHealthTag,
  morning: number,
  bedtime: number,
  wakeWindow: number,
  source: HistoryDay['source'],
): HistoryDay {
  const segments: HistorySegment[] = [];
  let cursor = morning;
  let napCount = 0;

  const pushAwake = (mins: number, label?: string) => {
    const end = Math.min(cursor + mins, bedtime);
    if (end <= cursor) return;
    segments.push({
      type: 'awake',
      startMinutes: cursor,
      endMinutes: end,
      durationMinutes: end - cursor,
      label,
    });
    cursor = end;
  };

  const pushSleep = (mins: number, label?: string) => {
    const end = Math.min(cursor + mins, bedtime);
    if (end <= cursor) return;
    napCount += 1;
    segments.push({
      type: 'sleep',
      startMinutes: cursor,
      endMinutes: end,
      durationMinutes: end - cursor,
      label: label ?? `Nap ${napCount}`,
    });
    cursor = end;
  };

  if (health === 'good') {
    // On-schedule: wake → nap → wake → nap … until bedtime
    const naps = [45, 40, 50, 35];
    naps.forEach((napMins, i) => {
      pushAwake(wakeWindow - (i > 0 ? Math.min(10, i * 5) : 0), i === 0 ? 'Morning wake' : `Wake ${i + 1}`);
      if (cursor + 60 >= bedtime) return;
      pushSleep(napMins);
    });
    if (cursor < bedtime) {
      pushAwake(bedtime - cursor, 'Evening wake');
    }
  } else if (health === 'sleepy') {
    // Slept a lot: short wakes, long naps
    const naps = [70, 80, 65, 55];
    naps.forEach((napMins, i) => {
      pushAwake(Math.max(30, wakeWindow - 20 - i * 5), i === 0 ? 'Short morning wake' : `Brief wake ${i + 1}`);
      if (cursor + 40 >= bedtime) return;
      pushSleep(napMins, `Long nap ${i + 1}`);
    });
    if (cursor < bedtime) {
      pushAwake(Math.min(35, bedtime - cursor), 'Drowsy evening');
    }
  } else {
    // Too active: missed windows — long overtired wakes, short/skipped naps
    pushAwake(wakeWindow + 55, 'Overwake morning');
    pushSleep(22, 'Catnap 1');
    pushAwake(wakeWindow + 40, 'Missed sweet spot');
    pushSleep(18, 'Catnap 2');
    pushAwake(wakeWindow + 25, 'Second-wind evening');
    if (cursor + 30 < bedtime) {
      pushSleep(25, 'Rescue nap');
    }
    if (cursor < bedtime) {
      pushAwake(bedtime - cursor, 'Fighting sleep');
    }
  }

  // Night sleep stub after bedtime (not counted in day awake)
  const totalSleepMinutes = segments
    .filter((s) => s.type === 'sleep')
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const awakeSegs = segments.filter((s) => s.type === 'awake');
  const totalAwakeMinutes = awakeSegs.reduce((sum, s) => sum + s.durationMinutes, 0);
  const longestWakeMinutes = awakeSegs.reduce(
    (max, s) => Math.max(max, s.durationMinutes),
    0,
  );

  const summaries: Record<DayHealthTag, string> = {
    good: 'On schedule — wake windows and naps stayed in range.',
    sleepy: 'High sleep day — longer naps and shorter wakes than usual.',
    active: 'Too active — missed sleep windows with long overtired wakes.',
  };

  return {
    dateKey,
    health,
    totalSleepMinutes,
    totalAwakeMinutes,
    napCount: segments.filter((s) => s.type === 'sleep').length,
    longestWakeMinutes,
    segments,
    summary: summaries[health],
    source,
  };
}

/**
 * Demo history for the past several weeks.
 * Most days good; 2 sleepy (overslept); several too-active (missed windows).
 */
export function generateDemoHistory(
  profile: BabyProfile,
  weeksBack = 3,
): HistoryDay[] {
  const range = getWakeWindowForAge(profile.ageWeeks);
  const wakeWindow = range.sweetSpot;
  const morning = parseTimeToMinutes(profile.morningWakeTime);
  const bedtime = parseTimeToMinutes(profile.targetBedtime);
  const days: HistoryDay[] = [];
  const totalDays = weeksBack * 7;

  // Fixed offsets from today so demo stays stable across reloads
  const sleepyOffsets = new Set([6, 17]);
  const activeOffsets = new Set([3, 9, 12, 15, 20]);

  for (let offset = 1; offset <= totalDays; offset++) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    const dateKey = toDateKey(d);

    let health: DayHealthTag = 'good';
    if (sleepyOffsets.has(offset)) health = 'sleepy';
    else if (activeOffsets.has(offset)) health = 'active';

    days.push(
      buildDayFromPattern(dateKey, health, morning, bedtime, wakeWindow, 'demo'),
    );
  }

  return days.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}
