export function formatTime(time: string | null): string {
  if (!time) return '-';
  return time;
}

export function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

export function compareTime(a: string, b: string): number {
  const timeA = parseTime(a);
  const timeB = parseTime(b);

  if (timeA.hours !== timeB.hours) {
    return timeA.hours - timeB.hours;
  }
  return timeA.minutes - timeB.minutes;
}

export function getCurrentDay(): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  return days[new Date().getDay()] as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
}

export function isWeekday(day: string): boolean {
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(day);
}

export function isWeekend(day: string): boolean {
  return ['saturday', 'sunday'].includes(day);
}
