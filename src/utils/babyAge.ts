/** Whole weeks since birth (floor). Future dates return 0. */
export function calculateAgeWeeks(dateOfBirth: string, now: Date = new Date()): number {
  const dob = parseIsoDateLocal(dateOfBirth);
  if (!dob) return 0;

  const start = startOfDay(dob);
  const end = startOfDay(now);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(days / 7);
}

export function formatAgeLabel(ageWeeks: number): string {
  if (ageWeeks <= 0) return 'Newborn · under 1 week';
  if (ageWeeks === 1) return '1 week old';
  return `${ageWeeks} weeks old`;
}

export function isValidDateOfBirth(dateOfBirth: string, now: Date = new Date()): boolean {
  const dob = parseIsoDateLocal(dateOfBirth);
  if (!dob) return false;
  const start = startOfDay(dob);
  const end = startOfDay(now);
  if (start.getTime() > end.getTime()) return false;
  // Soft cap: sleep architect targets newborns / infants (~2 years)
  const twoYearsMs = 730 * 24 * 60 * 60 * 1000;
  return end.getTime() - start.getTime() <= twoYearsMs;
}

function parseIsoDateLocal(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
