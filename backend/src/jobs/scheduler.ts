import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendPushToGroup } from '../lib/push';
import { getLocalParts, isScheduleDue } from '../lib/schedules';

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
