import type {
  BabyProfile,
  DayForecast,
  DailyRhythmState,
  RhythmPhase,
  ScheduleBlock,
  WakeWindowRange,
} from '../types/sleep';

/** Age-based wake window lookup (minutes). */
export function getWakeWindowForAge(ageWeeks: number): WakeWindowRange {
  if (ageWeeks <= 12) {
    return {
      min: 45,
      max: 60,
      sweetSpot: 55,
      absoluteMax: 75,
      label: 'Newborn (0–12 weeks)',
    };
  }
  if (ageWeeks <= 22) {
    // ~3–5 months (13–22 weeks)
    return {
      min: 90,
      max: 120,
      sweetSpot: 105,
      absoluteMax: 135,
      label: '3–5 months',
    };
  }
  // 6–8 months+
  return {
    min: 135,
    max: 165,
    sweetSpot: 150,
    absoluteMax: 180,
    label: '6–8 months',
  };
}

function parseTimeToMinutes(time: string): number {
  const cleaned = time.trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return 7 * 60;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3];

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  let hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${meridiem}`;
}

export interface ScheduleEngineInput {
  profile: BabyProfile;
  /** When omitted, elapsed awake is derived from the clock-active wake block. */
  elapsedAwakeMinutes?: number;
  lastNapDurationMinutes?: number;
  /** Minutes since midnight. Defaults to the real local clock. */
  nowMinutes?: number;
  isNapping?: boolean;
}

/** Local clock as minutes since midnight. */
export function getNowMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Mark blocks Passed / Now / Next from the clock.
 * If "now" falls in a gap, the next upcoming block becomes the focus (active).
 */
export function stampScheduleByClock(
  schedule: ScheduleBlock[],
  nowMinutes: number,
): ScheduleBlock[] {
  const stamped = schedule.map((block) => {
    const start = parseTimeToMinutes(block.startTime);
    let end = parseTimeToMinutes(block.endTime);
    // Bedtime may wrap visually; keep end after start for status math
    if (end < start) end += 24 * 60;

    if (nowMinutes >= end) {
      return { ...block, status: 'completed' as const };
    }
    if (nowMinutes >= start && nowMinutes < end) {
      return { ...block, status: 'active' as const };
    }
    return { ...block, status: 'projected' as const };
  });

  const hasActive = stamped.some((b) => b.status === 'active');
  if (hasActive) return stamped;

  const allDone = stamped.every((b) => b.status === 'completed');
  if (allDone) return stamped;

  // In a gap — focus the next planned block
  const nextIdx = stamped.findIndex((b) => b.status === 'projected');
  if (nextIdx === -1) return stamped;
  return stamped.map((block, i) =>
    i === nextIdx ? { ...block, status: 'active' as const } : block,
  );
}

/** Derive awake elapsed / napping from the clock-stamped schedule. */
export function deriveLiveAwakeState(
  schedule: ScheduleBlock[],
  nowMinutes: number,
  isNappingOverride?: boolean,
): { elapsedAwakeMinutes: number; isNapping: boolean } {
  const active = schedule.find((b) => b.status === 'active');

  if (isNappingOverride || active?.type === 'nap') {
    return { elapsedAwakeMinutes: 0, isNapping: true };
  }

  if (active && (active.type === 'wake' || active.type === 'wind_down')) {
    const start = parseTimeToMinutes(active.startTime);
    return {
      elapsedAwakeMinutes: Math.max(0, nowMinutes - start),
      isNapping: false,
    };
  }

  // Between blocks or after bedtime — use time since last completed wake/nap end
  const completed = [...schedule].reverse().find((b) => b.status === 'completed');
  if (completed) {
    const end = parseTimeToMinutes(completed.endTime);
    return {
      elapsedAwakeMinutes: Math.max(0, nowMinutes - end),
      isNapping: false,
    };
  }

  return { elapsedAwakeMinutes: 0, isNapping: false };
}

/**
 * Short Nap Rule: naps under 35 minutes leave residual adenosine sleep pressure,
 * so the next wake window contracts by 20 minutes.
 */
export function applyShortNapRule(
  baseWakeWindow: number,
  lastNapDurationMinutes?: number,
): { wakeWindow: number; isAdjusted: boolean; reason?: string } {
  if (lastNapDurationMinutes !== undefined && lastNapDurationMinutes < 35) {
    return {
      wakeWindow: Math.max(30, baseWakeWindow - 20),
      isAdjusted: true,
      reason:
        `Short nap (${lastNapDurationMinutes}m) left residual adenosine sleep pressure — next wake window contracted by 20 minutes.`,
    };
  }
  return { wakeWindow: baseWakeWindow, isAdjusted: false };
}

/**
 * Bridge Nap Rule: if the last scheduled nap ends > 3.5 hours before target bedtime,
 * insert an optional 15-minute bridge nap.
 */
export function maybeInsertBridgeNap(
  schedule: ScheduleBlock[],
  targetBedtime: string,
): ScheduleBlock[] {
  const naps = schedule.filter((b) => b.type === 'nap');
  if (naps.length === 0) return schedule;

  const lastNap = naps[naps.length - 1];
  const lastNapEnd = parseTimeToMinutes(lastNap.endTime);
  const bedtime = parseTimeToMinutes(targetBedtime);
  const gapHours = (bedtime - lastNapEnd) / 60;

  if (gapHours <= 3.5) return schedule;

  const bridgeStart = lastNapEnd + 90;
  const bridgeEnd = bridgeStart + 15;
  const bridge: ScheduleBlock = {
    id: 'bridge-nap',
    title: 'Optional Bridge Nap',
    type: 'nap',
    startTime: formatMinutesToTime(bridgeStart),
    endTime: formatMinutesToTime(bridgeEnd),
    durationMinutes: 15,
    status: 'projected',
    isAdjusted: true,
    adjustmentReason:
      `Last nap ends ${gapHours.toFixed(1)}h before bedtime — insert a 15m bridge nap to protect the evening.`,
  };

  const bedtimeIdx = schedule.findIndex((b) => b.type === 'bedtime' || b.type === 'wind_down');
  if (bedtimeIdx === -1) return [...schedule, bridge];
  return [...schedule.slice(0, bedtimeIdx), bridge, ...schedule.slice(bedtimeIdx)];
}

/** Day Nap Cap: flag any daytime nap ≥ 120 minutes. */
export function checkDayNapCap(schedule: ScheduleBlock[]): ScheduleBlock[] {
  return schedule.map((block) => {
    if (block.type === 'nap' && block.durationMinutes >= 120) {
      return {
        ...block,
        isAdjusted: true,
        adjustmentReason:
          block.adjustmentReason ??
          `Day nap cap alert: ${block.durationMinutes}m nap may cannibalize nighttime sleep. Cap daytime naps at under 120 minutes.`,
      };
    }
    return block;
  });
}

function derivePhase(
  elapsed: number,
  wakeWindow: number,
  isNapping: boolean,
): RhythmPhase {
  if (isNapping) return 'NAPPING';
  const ratio = elapsed / wakeWindow;
  if (ratio < 0.7) return 'AWAKE_ACTIVE';
  if (ratio < 0.9) return 'WIND_DOWN';
  if (ratio <= 1.1) return 'SWEET_SPOT';
  return 'OVERTIRED';
}

function phaseCopy(
  phase: RhythmPhase,
  remaining: number,
  elapsed: number,
  absoluteMax: number,
): {
  headline: string;
  guidance: string;
  badge: string;
  cues: string[];
} {
  switch (phase) {
    case 'AWAKE_ACTIVE':
      return {
        headline: 'Active Awake Time',
        guidance:
          'Enjoy tummy time, feeds, and gentle play. Watch for early tired cues as the window progresses.',
        badge: 'Active Awake',
        cues: ['Brief eye contact fades', 'Slight hand-to-face rubbing'],
      };
    case 'WIND_DOWN':
      return {
        headline: 'Active Wind-Down',
        guidance:
          'Dim lights, lower stimulation, and begin your sleep routine. The sweet spot is approaching.',
        badge: 'Active Wind-Down',
        cues: ['Reddish eyebrows', 'Staring into distance', 'Yawning'],
      };
    case 'SWEET_SPOT':
      return {
        headline: `${remaining <= 0 ? 'Now' : `${remaining} mins`} to Sweet Spot`,
        guidance:
          'Optimal sleep window — put baby down now. Sleep pressure is high and cortisol is still low.',
        badge: 'Optimal Sleep Window',
        cues: ['Glazed eyes', 'Jerky movements calming', 'Quiet fussiness'],
      };
    case 'OVERTIRED': {
      const isCritical = elapsed >= absoluteMax;
      return {
        headline: isCritical ? 'Critical Overwake Alert' : 'Cortisol Spike Alert',
        guidance: isCritical
          ? `${elapsed}m awake — at/past the ~${absoluteMax}m max. Missed nap window. Dark room, feed, rock with white noise; expect a fighty settle and shifted naps.`
          : 'Baby may be overtired. Use extra soothing — rocking, white noise, feed — and expect a trickier settle.',
        badge: isCritical ? 'Critical Overwake' : 'Cortisol Spike Alert',
        cues: ['Arching back', 'Second wind energy', 'Inconsolable fuss'],
      };
    }
    case 'NAPPING':
      return {
        headline: 'Currently Napping',
        guidance:
          'Protect the nap environment. Note duration when they wake — short naps may shorten the next wake window.',
        badge: 'Napping',
        cues: ['Watch for early wake stirs', 'Note total nap length'],
      };
  }
}

/** Build today's schedule from profile + live awake state. */
export function buildTodaySchedule(input: ScheduleEngineInput): ScheduleBlock[] {
  const { profile, lastNapDurationMinutes } = input;
  const range = getWakeWindowForAge(profile.ageWeeks);
  const shortNap = applyShortNapRule(range.sweetSpot, lastNapDurationMinutes);
  const wakeWindow = shortNap.wakeWindow;
  const nowMinutes = input.nowMinutes ?? getNowMinutes();

  const morning = parseTimeToMinutes(profile.morningWakeTime);
  const bedtime = parseTimeToMinutes(profile.targetBedtime);

  // When still awake past the planned window, stretch morning wake and shift the day.
  const elapsedAwake = input.elapsedAwakeMinutes;
  const isOverwake =
    elapsedAwake !== undefined &&
    input.isNapping !== true &&
    elapsedAwake > wakeWindow;
  const isCriticalOverwake = isOverwake && elapsedAwake! >= range.absoluteMax;

  // Newborn ~6 weeks: typically 4–5 short naps
  const napDurations =
    profile.ageWeeks <= 12
      ? [45, 40, 50, 35]
      : profile.ageWeeks <= 22
        ? [75, 90, 45]
        : [90, 120];

  const blocks: ScheduleBlock[] = [];
  let cursor = morning;

  // Keep end strictly after "now" so stampScheduleByClock marks this wake as active.
  const firstWakeEnd = isOverwake
    ? Math.max(morning + elapsedAwake!, nowMinutes + 1)
    : morning + wakeWindow;
  const firstWakeDuration = firstWakeEnd - morning;
  blocks.push({
    id: 'wake-0',
    title: isCriticalOverwake ? 'Extended Morning Wake (Overdue)' : 'Morning Wake Window',
    type: 'wake',
    startTime: formatMinutesToTime(morning),
    endTime: formatMinutesToTime(firstWakeEnd),
    durationMinutes: firstWakeDuration,
    status: 'projected',
    isAdjusted: shortNap.isAdjusted || isOverwake,
    isAlert: isCriticalOverwake,
    adjustmentReason: isCriticalOverwake
      ? `Critical: ${elapsedAwake}m awake (max ~${range.absoluteMax}m for this age). Nap window missed — later naps shifted later.`
      : isOverwake
        ? `Wake overrun: ${elapsedAwake}m awake vs ${wakeWindow}m target. Schedule shifted.`
        : shortNap.reason,
  });

  cursor = firstWakeEnd;

  napDurations.forEach((napMins, index) => {
    if (cursor + napMins + 60 > bedtime) return;

    const napStart = cursor;
    const napEnd = cursor + napMins;
    const isLastNapShort =
      lastNapDurationMinutes !== undefined &&
      index === 0 &&
      lastNapDurationMinutes < 35;

    blocks.push({
      id: `nap-${index}`,
      title: `Nap ${index + 1}`,
      type: 'nap',
      startTime: formatMinutesToTime(napStart),
      endTime: formatMinutesToTime(napEnd),
      durationMinutes: isLastNapShort ? lastNapDurationMinutes! : napMins,
      status: 'projected',
      isAdjusted: isLastNapShort,
      adjustmentReason: isLastNapShort
        ? `Logged short nap of ${lastNapDurationMinutes}m — schedule rerouted.`
        : undefined,
    });

    cursor = napEnd;

    const nextWake = Math.min(wakeWindow, Math.max(range.min, wakeWindow - index * 5));
    const wakeEnd = cursor + nextWake;

    if (wakeEnd + 30 >= bedtime) return;

    blocks.push({
      id: `wake-${index + 1}`,
      title: `Wake Window ${index + 2}`,
      type: 'wake',
      startTime: formatMinutesToTime(cursor),
      endTime: formatMinutesToTime(wakeEnd),
      durationMinutes: nextWake,
      status: 'projected',
      isAdjusted: shortNap.isAdjusted && index === 0,
      adjustmentReason:
        shortNap.isAdjusted && index === 0 ? shortNap.reason : undefined,
    });

    cursor = wakeEnd;
  });

  const windDownStart = bedtime - 20;
  blocks.push({
    id: 'wind-down',
    title: 'Wind-Down Routine',
    type: 'wind_down',
    startTime: formatMinutesToTime(windDownStart),
    endTime: formatMinutesToTime(bedtime),
    durationMinutes: 20,
    status: 'projected',
    isAdjusted: false,
  });

  blocks.push({
    id: 'bedtime',
    title: 'Bedtime',
    type: 'bedtime',
    startTime: formatMinutesToTime(bedtime),
    endTime: formatMinutesToTime(bedtime + 30),
    durationMinutes: 30,
    status: 'projected',
    isAdjusted: false,
  });

  let schedule = maybeInsertBridgeNap(blocks, profile.targetBedtime);
  schedule = checkDayNapCap(schedule);
  return stampScheduleByClock(schedule, nowMinutes);
}

export function computeDailyRhythmState(input: ScheduleEngineInput): DailyRhythmState {
  const range = getWakeWindowForAge(input.profile.ageWeeks);
  const shortNap = applyShortNapRule(range.sweetSpot, input.lastNapDurationMinutes);
  const wakeWindow = shortNap.wakeWindow;
  const nowMinutes = input.nowMinutes ?? getNowMinutes();
  const schedule = buildTodaySchedule({ ...input, nowMinutes });

  const live = deriveLiveAwakeState(schedule, nowMinutes, input.isNapping);
  const elapsed =
    input.elapsedAwakeMinutes !== undefined
      ? input.elapsedAwakeMinutes
      : live.elapsedAwakeMinutes;
  const isNapping =
    input.isNapping !== undefined ? input.isNapping : live.isNapping;

  const remaining = Math.max(0, wakeWindow - elapsed);
  const progressPercent = Math.min(100, Math.round((elapsed / wakeWindow) * 100));
  const phase = derivePhase(elapsed, wakeWindow, isNapping);
  const copy = phaseCopy(phase, remaining, elapsed, range.absoluteMax);

  return {
    currentPhase: phase,
    elapsedAwakeMinutes: elapsed,
    remainingMinutesToSweetSpot: remaining,
    progressPercent,
    headline: copy.headline,
    activeGuidance: copy.guidance,
    cuesToWatch: copy.cues,
    schedule,
    badgeLabel: copy.badge,
  };
}

/**
 * Multi-day projector: 3-day rhythm forecast from current bedtime / wake patterns
 * and developmental age trends.
 */
export function projectMultiDayRhythm(
  profile: BabyProfile,
  days: number = 3,
): DayForecast[] {
  const range = getWakeWindowForAge(profile.ageWeeks);
  const forecasts: DayForecast[] = [];
  const dayLabels = ['Today', 'Tomorrow', 'Day After'];

  for (let i = 0; i < days; i++) {
    // Slight developmental drift: wake windows lengthen ~2m per day as baby ages
    const projectedWeeks = profile.ageWeeks + i / 7;
    const projectedRange = getWakeWindowForAge(projectedWeeks);
    const wakePad = i * 2;

    const morning = parseTimeToMinutes(profile.morningWakeTime) + (i === 0 ? 0 : Math.min(15, i * 5));
    const bedtime =
      parseTimeToMinutes(profile.targetBedtime) - (i > 0 ? Math.min(10, i * 5) : 0);

    const napPlan =
      projectedWeeks <= 12
        ? [
            { title: 'Morning Nap', mins: 45 + i * 2 },
            { title: 'Midday Nap', mins: 50 },
            { title: 'Afternoon Nap', mins: 40 - i },
            { title: 'Catnap', mins: 25 },
          ]
        : projectedWeeks <= 22
          ? [
              { title: 'Morning Nap', mins: 75 },
              { title: 'Midday Nap', mins: 90 + i },
              { title: 'Late Afternoon Nap', mins: 40 },
            ]
          : [
              { title: 'Morning Nap', mins: 90 },
              { title: 'Afternoon Nap', mins: 120 },
            ];

    let cursor = morning + projectedRange.sweetSpot + wakePad;
    const naps: DayForecast['naps'] = [];
    let totalDaySleep = 0;

    for (const nap of napPlan) {
      if (cursor + nap.mins + 45 > bedtime) break;
      const start = cursor;
      const end = cursor + nap.mins;
      naps.push({
        title: nap.title,
        startTime: formatMinutesToTime(start),
        endTime: formatMinutesToTime(end),
        durationMinutes: nap.mins,
      });
      totalDaySleep += nap.mins;
      cursor = end + projectedRange.sweetSpot;
    }

    forecasts.push({
      dayLabel: dayLabels[i] ?? `Day +${i}`,
      dateOffset: i,
      expectedWake: formatMinutesToTime(morning),
      naps,
      bedtime: formatMinutesToTime(bedtime),
      totalDaySleepMinutes: totalDaySleep,
      notes:
        i === 0
          ? `Wake window sweet spot ~${range.sweetSpot}m (${range.label}).`
          : `Projected slight lengthening toward ${projectedRange.sweetSpot}m windows as circadian rhythm consolidates.`,
    });
  }

  return forecasts;
}

export { formatMinutesToTime, parseTimeToMinutes };
