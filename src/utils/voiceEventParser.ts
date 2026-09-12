import type { EventType } from '../types/sleep';

export interface ParsedVoiceEvent {
  type: EventType;
  notes: string;
  detectedCues: string[];
  confidence: 'high' | 'medium' | 'low';
  /** How many minutes before "now" the event actually happened. */
  minutesAgo: number;
  /** Absolute epoch ms when the event occurred. */
  occurredAt: number;
  /** Parsed nap/feed duration when mentioned (e.g. "napped for 22 minutes"). */
  durationMinutes?: number;
}

const CUE_PATTERNS: Array<{ pattern: RegExp; cue: string }> = [
  { pattern: /red\s*eyes?/i, cue: 'Red eyes' },
  { pattern: /yawning|yawn/i, cue: 'Yawning' },
  { pattern: /fussy|fussing|cranky/i, cue: 'Fussiness' },
  { pattern: /rubbing\s*(eyes?|face)/i, cue: 'Eye rubbing' },
  { pattern: /staring|zone[d]? out/i, cue: 'Staring / zoning out' },
  { pattern: /arching|arch(ed|ing)?\s*back/i, cue: 'Arching back' },
];

const WORD_TO_NUMBER: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  few: 5,
  couple: 2,
  half: 0.5,
};

function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/-/g, ' ');
  if (/^\d+(?:\.\d+)?$/.test(cleaned)) return Number(cleaned);
  if (cleaned in WORD_TO_NUMBER) return WORD_TO_NUMBER[cleaned];

  // "twenty five" / "twenty-five"
  const parts = cleaned.split(/\s+/);
  if (parts.length === 2 && parts[0] in WORD_TO_NUMBER && parts[1] in WORD_TO_NUMBER) {
    const a = WORD_TO_NUMBER[parts[0]];
    const b = WORD_TO_NUMBER[parts[1]];
    if (a >= 20 && b < 10) return a + b;
  }
  return null;
}

/**
 * Extract relative lag: "10 minutes ago", "an hour ago", "half an hour ago", "just now".
 */
export function extractMinutesAgo(transcript: string, now: number = Date.now()): {
  minutesAgo: number;
  occurredAt: number;
} {
  const text = transcript.toLowerCase().replace(/\s+/g, ' ');

  if (/\bjust\s+now\b/.test(text) || /\ba\s+moment\s+ago\b/.test(text)) {
    return { minutesAgo: 0, occurredAt: now };
  }

  if (/\bhalf\s*(?:an?\s*)?hour\s*ago\b/.test(text)) {
    return { minutesAgo: 30, occurredAt: now - 30 * 60_000 };
  }

  // "about 10 minutes ago" / "10 mins ago" / "10 min ago" / "an hour ago"
  const agoMatch = text.match(
    /\b(?:about|around|roughly|like)?\s*([a-z0-9]+(?:\s+[a-z]+)?)\s*(minutes?|mins?|min|hours?|hrs?|hr)\s*ago\b/,
  );
  if (agoMatch) {
    const amount = parseAmount(agoMatch[1]);
    if (amount !== null) {
      const unit = agoMatch[2];
      const isHour = /^h/.test(unit);
      const minutesAgo = Math.round(amount * (isHour ? 60 : 1));
      const clamped = Math.max(0, Math.min(minutesAgo, 24 * 60));
      return { minutesAgo: clamped, occurredAt: now - clamped * 60_000 };
    }
  }

  // Speech quirk: "10 minutes a go"
  const aGoMatch = text.match(
    /\b([a-z0-9]+(?:\s+[a-z]+)?)\s*(minutes?|mins?|min|hours?|hrs?|hr)\s+a\s+go\b/,
  );
  if (aGoMatch) {
    const amount = parseAmount(aGoMatch[1]);
    if (amount !== null) {
      const isHour = /^h/.test(aGoMatch[2]);
      const minutesAgo = Math.round(amount * (isHour ? 60 : 1));
      const clamped = Math.max(0, Math.min(minutesAgo, 24 * 60));
      return { minutesAgo: clamped, occurredAt: now - clamped * 60_000 };
    }
  }

  return { minutesAgo: 0, occurredAt: now };
}

/**
 * Extract an explicit duration: "for 22 minutes", "only 22m", "22 minute nap".
 */
export function extractDurationMinutes(transcript: string): number | undefined {
  const text = transcript.toLowerCase().replace(/\s+/g, ' ');

  const patterns = [
    /\b(?:for|only|just|about|around)\s+([a-z0-9]+(?:\s+[a-z]+)?)\s*(minutes?|mins?|min)\b/,
    /\b([a-z0-9]+(?:\s+[a-z]+)?)\s*(?:minute|minutes|mins?|min)\s+nap\b/,
    /\bnapped?\s+(?:for\s+)?([a-z0-9]+(?:\s+[a-z]+)?)\s*(minutes?|mins?|min)\b/,
    /\bnap\s+(?:was|of|lasted)\s+([a-z0-9]+(?:\s+[a-z]+)?)\s*(minutes?|mins?|min)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const amount = parseAmount(match[1]);
    if (amount !== null && amount > 0) {
      return Math.min(Math.round(amount), 240);
    }
  }

  return undefined;
}

function detectType(lower: string, detectedCues: string[]): EventType {
  // Order matters: nap end before generic wake
  if (/\b(woke\s*from\s*nap|nap\s*(ended|over|was\s+only)|finished\s*napping|done\s+napping)\b/.test(lower)) {
    return 'NAP_END';
  }
  if (/\b(fell\s*asleep|sleeping|nap\s*start|went\s*down|dozing|started\s+napping)\b/.test(lower)) {
    return 'NAP_START';
  }
  if (/\b(woke\s*up|awake|waking\s*up|just\s*woke)\b/.test(lower)) {
    return 'WAKE';
  }
  if (/\b(fed|feed|nursed|nursing|bottle|breastfed)\b/.test(lower)) {
    return 'FEED';
  }
  if (detectedCues.length > 0 || /\b(tired|sleepy|drowsy|overtired)\b/.test(lower)) {
    return 'TIRED_CUE';
  }
  return 'NOTE';
}

/**
 * Rule-based event extractor — includes lag ("10 minutes ago") and durations.
 */
export function extractEventFromTranscript(
  transcript: string,
  now: number = Date.now(),
): ParsedVoiceEvent {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const detectedCues = CUE_PATTERNS.filter((c) => c.pattern.test(text)).map((c) => c.cue);
  const { minutesAgo, occurredAt } = extractMinutesAgo(text, now);
  const durationMinutes = extractDurationMinutes(text);
  const type = detectType(lower, detectedCues);

  let confidence: ParsedVoiceEvent['confidence'] = 'low';
  if (type !== 'NOTE' && type !== 'TIRED_CUE') confidence = 'high';
  else if (type === 'TIRED_CUE') confidence = 'medium';

  return {
    type,
    notes: text,
    detectedCues:
      type === 'TIRED_CUE' && detectedCues.length === 0
        ? ['General tiredness']
        : detectedCues,
    confidence,
    minutesAgo,
    occurredAt,
    durationMinutes,
  };
}

export function formatLagLabel(minutesAgo: number): string | null {
  if (minutesAgo <= 0) return null;
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hours = Math.floor(minutesAgo / 60);
  const mins = minutesAgo % 60;
  if (mins === 0) return `${hours}h ago`;
  return `${hours}h ${mins}m ago`;
}
