const TIMEZONE = 'Africa/Addis_Ababa';

function ethiopiaParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** YYYY-MM-DD in East Africa Time. */
export function ethiopiaDateString(date: Date = new Date()): string {
  const { year, month, day } = ethiopiaParts(date);
  return `${year}-${month}-${day}`;
}

/** h:mm AM/PM in East Africa Time (order timestamps). */
export function ethiopiaTime12(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** HH:mm:ss in East Africa Time. */
export function ethiopiaTime24(date: Date = new Date()): string {
  const { hour, minute, second } = ethiopiaParts(date);
  return `${hour}:${minute}:${second}`;
}

export function toEthiopiaDate(value: string | Date): string {
  return ethiopiaDateString(value instanceof Date ? value : new Date(value));
}

export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function addMonths(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1 + months, day));
  return utc.toISOString().slice(0, 10);
}

export function datesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

export function daysInCalendarMonth(year: number, monthZeroIndexed: number): number {
  return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
}

export function dayName(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] || 'Unknown';
}

export function monthName(yearMonthStr: string): string {
  const [yearStr, monthStr] = yearMonthStr.split('-');
  const monthIndex = parseInt(monthStr, 10) - 1;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[monthIndex]} ${yearStr}`;
}
