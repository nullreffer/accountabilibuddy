import type { Schedule } from './api';

const parseTime = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0
  };
};

const getLocalParts = (date: Date, timezone = 'UTC') => {
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
  const find = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
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

const isScheduledForToday = (schedule: Schedule, date: Date) => {
  const local = getLocalParts(date, schedule.timezone);
  if (schedule.frequency === 'weekly' || schedule.frequency === 'custom') {
    return schedule.daysOfWeek.includes(local.weekday);
  }
  return true;
};

export const getScheduleDateKey = (schedule: Schedule, date: Date) =>
  getLocalParts(date, schedule.timezone).dateKey;

export const hasScheduleStarted = (schedule: Schedule, date = new Date()) => {
  if (!isScheduledForToday(schedule, date)) {
    return false;
  }

  const local = getLocalParts(date, schedule.timezone);
  const target = parseTime(schedule.time);
  return local.hour * 60 + local.minute >= target.hours * 60 + target.minutes;
};
