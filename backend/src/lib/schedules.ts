export type ScheduleLike = {
  id: string;
  frequency: string;
  daysOfWeek: number[];
  time: string;
  timezone: string;
};

export const parseTime = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0
  };
};

export const getLocalParts = (date: Date, timezone = 'UTC') => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  const parts = formatter.formatToParts(date);
  const find = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    hour: Number(find('hour')),
    minute: Number(find('minute')),
    weekday: weekdayMap[find('weekday')] ?? date.getUTCDay(),
    dateKey: `${find('year')}-${find('month')}-${find('day')}`
  };
};

export const isScheduledForDay = (schedule: ScheduleLike, date: Date) => {
  const local = getLocalParts(date, schedule.timezone);
  if (schedule.frequency === 'weekly' || schedule.frequency === 'custom') {
    return schedule.daysOfWeek.includes(local.weekday);
  }
  return true;
};

export const hasScheduleStarted = (schedule: ScheduleLike, date = new Date()) => {
  if (!isScheduledForDay(schedule, date)) {
    return false;
  }

  const local = getLocalParts(date, schedule.timezone);
  const target = parseTime(schedule.time);
  return local.hour * 60 + local.minute >= target.hours * 60 + target.minutes;
};

export const isScheduleDue = (schedule: ScheduleLike, now = new Date(), windowMinutes = 1) => {
  const local = getLocalParts(now, schedule.timezone);
  const target = parseTime(schedule.time);
  const diff = Math.abs(local.hour * 60 + local.minute - (target.hours * 60 + target.minutes));

  if (diff > windowMinutes) {
    return false;
  }

  if (schedule.frequency === 'weekly' || schedule.frequency === 'custom') {
    return schedule.daysOfWeek.includes(local.weekday);
  }

  return true;
};
