export type BabyAvatarId =
  | 'moonbeam'
  | 'cloud'
  | 'starling'
  | 'lamb'
  | 'bunny'
  | 'otter';

export interface BabyAvatar {
  id: BabyAvatarId;
  label: string;
  emoji: string;
  accent: string;
  ring: string;
}

export interface BabyProfile {
  name: string;
  dateOfBirth: string; // ISO date YYYY-MM-DD
  avatarId: BabyAvatarId;
  ageWeeks: number;
  morningWakeTime: string;
  targetBedtime: string;
  defaultWakeWindowMinutes: number;
}

export type EventType =
  | 'WAKE'
  | 'NAP_START'
  | 'NAP_END'
  | 'FEED'
  | 'TIRED_CUE'
  | 'NOTE';

export interface LoggedEvent {
  id: string;
  timestamp: number;
  type: EventType;
  durationMinutes?: number;
  notes?: string;
  detectedCues: string[];
  /** Minutes before log time that the event actually occurred (0 = now). */
  minutesAgo?: number;
}

export interface ScheduleBlock {
  id: string;
  title: string;
  type: 'wake' | 'nap' | 'wind_down' | 'bedtime';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: 'completed' | 'active' | 'projected';
  isAdjusted: boolean;
  adjustmentReason?: string;
}

export type RhythmPhase =
  | 'AWAKE_ACTIVE'
  | 'WIND_DOWN'
  | 'SWEET_SPOT'
  | 'OVERTIRED'
  | 'NAPPING';

export interface DailyRhythmState {
  currentPhase: RhythmPhase;
  elapsedAwakeMinutes: number;
  remainingMinutesToSweetSpot: number;
  progressPercent: number;
  headline: string;
  activeGuidance: string;
  cuesToWatch: string[];
  schedule: ScheduleBlock[];
}

export interface WakeWindowRange {
  min: number;
  max: number;
  sweetSpot: number;
  absoluteMax: number;
  label: string;
}

export interface DayForecast {
  dayLabel: string;
  dateOffset: number;
  expectedWake: string;
  naps: Array<{ title: string; startTime: string; endTime: string; durationMinutes: number }>;
  bedtime: string;
  totalDaySleepMinutes: number;
  notes: string;
}

export interface DemoScenario {
  id: string;
  label: string;
  elapsedAwakeMinutes: number;
  lastNapDurationMinutes?: number;
  phaseOverride?: RhythmPhase;
}
