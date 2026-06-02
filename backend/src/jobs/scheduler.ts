import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendPushToGroup } from '../lib/push';

type ScheduleRow = {
  id: string;
  groupId: string;
  name: string;
  frequency: string;
  daysOfWeek: number[];
  time: string;
  timezone: string;
};

const WINDOW_MINUTES = 1;

const parseTime = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return { hours: Number.isFinite(h) ? h : 9, minutes: Number.isFinite(m) ? m : 0 };
};

const getLocalParts = (date: Date, timezone = 'UTC') => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  });

  const parts = fmt.formatToParts(date);
  const find = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };

  return {
    hour: Number(find('hour')),
    minute: Number(find('minute')),
    weekday: weekdayMap[find('weekday')] ?? date.getUTCDay(),
    dateKey: `${find('year')}-${find('month')}-${find('day')}`
  };
};

const isScheduleDue = (schedule: ScheduleRow, now = new Date()) => {
  const local = getLocalParts(now, schedule.timezone);
  const target = parseTime(schedule.time);
  const diff = Math.abs(local.hour * 60 + local.minute - (target.hours * 60 + target.minutes));

  if (diff > WINDOW_MINUTES) return false;

  if (schedule.frequency === 'weekly' || schedule.frequency === 'custom') {
    return schedule.daysOfWeek.includes(local.weekday);
  }

  return true;
};

// Run every minute — send schedule reminders
const scheduleReminders = cron.schedule('* * * * *', async () => {
  try {
    const schedules = await prisma.schedule.findMany({
      include: { group: true }
    });
    const now = new Date();

    await Promise.allSettled(
      schedules
        .filter((s) => isScheduleDue(s, now))
        .map((s) =>
          sendPushToGroup(
            s.groupId,
            'Check-in reminder',
            `It's time for ${s.name} check-in in ${s.group.name}.`,
            { groupId: s.groupId, scheduleId: s.id, type: 'reminder' }
          )
        )
    );
  } catch (err) {
    console.error('[scheduler] reminder error', err);
  }
});

// Run every hour — process missed check-ins and increment jars
const jarProcessing = cron.schedule('0 * * * *', async () => {
  try {
    const groups = await prisma.group.findMany({
      where: { jarEnabled: true },
      include: {
        schedules: true,
        members: true
      }
    });
    const now = new Date();

    await Promise.allSettled(
      groups.flatMap((group) =>
        group.schedules
          .filter((s) => isScheduleDue(s, now))
          .flatMap((schedule) => {
            const local = getLocalParts(now, schedule.timezone);
            const dateKey = local.dateKey;
            const amount = Number(group.jarAmount);

            return group.members.map(async (member) => {
              const checkinId = `${schedule.id}_${member.userId}_${dateKey}`;
              const existing = await prisma.checkin.findUnique({ where: { id: checkinId } });
              if (existing) return;

              const user = await prisma.user.findUnique({ where: { id: member.userId } });

              await prisma.checkin.create({
                data: {
                  id: checkinId,
                  userId: member.userId,
                  groupId: group.id,
                  scheduleId: schedule.id,
                  date: dateKey,
                  completedAt: now,
                  photoUrl: null,
                  status: 'missed'
                }
              });

              await prisma.jar.upsert({
                where: { userId_groupId: { userId: member.userId, groupId: group.id } },
                update: { count: { increment: 1 }, totalOwed: { increment: amount } },
                create: {
                  userId: member.userId,
                  groupId: group.id,
                  count: 1,
                  totalOwed: amount,
                }
              });

              if (user) {
                sendPushToGroup(
                  group.id,
                  'Missed check-in',
                  `${user.displayName} missed their ${schedule.name} check-in.`,
                  { groupId: group.id, type: 'missed' }
                ).catch((e) => console.error('Push error', e));
              }
            });
          })
      )
    );
  } catch (err) {
    console.error('[scheduler] jar processing error', err);
  }
});

export const startScheduler = () => {
  scheduleReminders.start();
  jarProcessing.start();
  console.log('[scheduler] started');
};

export const stopScheduler = () => {
  scheduleReminders.stop();
  jarProcessing.stop();
};
