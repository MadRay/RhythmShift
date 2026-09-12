import type { HistoryDay, HistorySegment, LoggedEvent } from '../types/sleep';
import { toDateKey } from './demoHistory';
import { parseTimeToMinutes } from './scheduleEngine';

const EVENTS_KEY = 'rhythmshift.loggedEvents';

export function loadLoggedEvents(): LoggedEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LoggedEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.timestamp === 'number' && e.type);
  } catch {
    return [];
  }
}

export function saveLoggedEvents(events: LoggedEvent[]): void {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(0, 500)));
}

function dateKeyFromTimestamp(ts: number): string {
  return toDateKey(new Date(ts));
}

function minutesFromTimestamp(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Build HistoryDay summaries from persisted user logs (main screen input).
 * Groups by local calendar day and reconstructs sleep/awake segments.
 */
export function historyDaysFromEvents(events: LoggedEvent[]): HistoryDay[] {
  const byDay = new Map<string, LoggedEvent[]>();
  for (const evt of events) {
    const key = dateKeyFromTimestamp(evt.timestamp);
    const list = byDay.get(key) ?? [];
    list.push(evt);
    byDay.set(key, list);
  }

  const days: HistoryDay[] = [];
  for (const [dateKey, dayEvents] of byDay) {
    const sorted = [...dayEvents].sort((a, b) => a.timestamp - b.timestamp);
    const segments: HistorySegment[] = [];
    let openNapStart: number | null = null;
    let lastWakeStart: number | null = null;
    let napCount = 0;

    for (const evt of sorted) {
      const mins = minutesFromTimestamp(evt.timestamp);

      if (evt.type === 'WAKE') {
        if (openNapStart !== null) {
          napCount += 1;
          segments.push({
            type: 'sleep',
            startMinutes: openNapStart,
            endMinutes: mins,
            durationMinutes: Math.max(1, mins - openNapStart),
            label: `Nap ${napCount}`,
          });
          openNapStart = null;
        }
        lastWakeStart = mins;
      } else if (evt.type === 'NAP_START') {
        if (lastWakeStart !== null && mins > lastWakeStart) {
          segments.push({
            type: 'awake',
            startMinutes: lastWakeStart,
            endMinutes: mins,
            durationMinutes: mins - lastWakeStart,
            label: 'Awake',
          });
          lastWakeStart = null;
        }
        openNapStart = mins;
      } else if (evt.type === 'NAP_END') {
        const start =
          openNapStart ??
          (evt.durationMinutes !== undefined
            ? mins - evt.durationMinutes
            : mins - 30);
        napCount += 1;
        segments.push({
          type: 'sleep',
          startMinutes: start,
          endMinutes: mins,
          durationMinutes:
            evt.durationMinutes ?? Math.max(1, mins - start),
          label: `Nap ${napCount}`,
        });
        openNapStart = null;
        lastWakeStart = mins;
      }
    }

    // Close dangling awake until a reasonable evening cutoff if needed
    if (lastWakeStart !== null) {
      const end = Math.max(lastWakeStart + 1, Math.min(parseTimeToMinutes('07:30 PM'), 22 * 60));
      if (end > lastWakeStart) {
        segments.push({
          type: 'awake',
          startMinutes: lastWakeStart,
          endMinutes: end,
          durationMinutes: end - lastWakeStart,
          label: 'Awake',
        });
      }
    }

    segments.sort((a, b) => a.startMinutes - b.startMinutes);

    const sleepSegs = segments.filter((s) => s.type === 'sleep');
    const awakeSegs = segments.filter((s) => s.type === 'awake');
    const totalSleepMinutes = sleepSegs.reduce((s, x) => s + x.durationMinutes, 0);
    const totalAwakeMinutes = awakeSegs.reduce((s, x) => s + x.durationMinutes, 0);
    const longestWakeMinutes = awakeSegs.reduce(
      (m, x) => Math.max(m, x.durationMinutes),
      0,
    );

    // Heuristic tags from logged day shape
    let health: HistoryDay['health'] = 'good';
    if (totalSleepMinutes >= 220 || (sleepSegs.length >= 3 && longestWakeMinutes < 50)) {
      health = 'sleepy';
    } else if (longestWakeMinutes >= 100 || (totalSleepMinutes > 0 && totalSleepMinutes < 90)) {
      health = 'active';
    }

    const summaries = {
      good: 'Logged day — rhythm looked on track.',
      sleepy: 'Logged day — higher sleep / shorter wakes.',
      active: 'Logged day — long wakes or light daytime sleep.',
    } as const;

    if (segments.length === 0) continue;

    days.push({
      dateKey,
      health,
      totalSleepMinutes,
      totalAwakeMinutes,
      napCount: sleepSegs.length,
      longestWakeMinutes,
      segments,
      summary: summaries[health],
      source: 'logged',
    });
  }

  return days.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}

/** Demo days as base; logged days override the same dateKey. */
export function mergeHistoryDays(
  demoDays: HistoryDay[],
  loggedDays: HistoryDay[],
): HistoryDay[] {
  const map = new Map<string, HistoryDay>();
  for (const day of demoDays) map.set(day.dateKey, day);
  for (const day of loggedDays) map.set(day.dateKey, day);
  return [...map.values()].sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}
