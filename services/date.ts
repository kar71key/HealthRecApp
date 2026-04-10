export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toIsoAtLocalTime(
  localDate: string,
  hour: number,
  minute: number,
): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return date.toISOString();
}

export function getLocalDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toLocalDateString(date);
}

export function getWeekdayShort(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: 'short',
  });
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export function isSameLocalDate(leftIso: string, rightIso: string): boolean {
  return toLocalDateString(new Date(leftIso)) === toLocalDateString(new Date(rightIso));
}

export function getHourFromIso(iso: string): number {
  return new Date(iso).getHours();
}
