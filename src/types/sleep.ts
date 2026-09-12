export type BabyAvatarId =
  | 'boy-fair'
  | 'boy-medium'
  | 'boy-deep'
  | 'girl-fair'
  | 'girl-medium'
  | 'girl-deep';

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
  /** True when the block signals a critical rhythm failure (e.g. extreme overwake). */
  isAlert?: boolean;
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
  /** Phase badge label (may escalate within a phase, e.g. critical overwake). */
  badgeLabel?: string;
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

/** Day health for History mode — problem days are color-tagged. */
export type DayHealthTag = 'good' | 'sleepy' | 'active';

export interface HistorySegment {
  type: 'sleep' | 'awake';
  /** Minutes since midnight. */
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  label?: string;
}

export interface HistoryDay {
  /** Local calendar date YYYY-MM-DD */
  dateKey: string;
  health: DayHealthTag;
  totalSleepMinutes: number;
  totalAwakeMinutes: number;
  napCount: number;
  longestWakeMinutes: number;
  segments: HistorySegment[];
  summary: string;
  source: 'demo' | 'logged';
}
