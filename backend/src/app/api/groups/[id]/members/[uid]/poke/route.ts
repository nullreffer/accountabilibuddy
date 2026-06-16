import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { postSystemMessage } from '@/lib/chat';
import { prisma } from '@/lib/prisma';
import { badRequest, handleError, notFound, ok } from '@/lib/response';
import { getLocalParts, hasScheduleStarted } from '@/lib/schedules';
import { sendPushToUser } from '@/lib/push';

type RouteContext = { params: Promise<{ id: string; uid: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const requestingUserId = requireAuth(req);
    const { id: groupId, uid } = await ctx.params;

    if (requestingUserId === uid) {
      return badRequest('You cannot poke yourself.');
    }

    const [requester, target, requesterUser, targetUser, group] = await Promise.all([
      prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: requestingUserId, groupId } }
      }),
      prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: uid, groupId } }
      }),
      prisma.user.findUnique({ where: { id: requestingUserId } }),
      prisma.user.findUnique({ where: { id: uid } }),
      prisma.group.findUnique({
        where: { id: groupId },
        include: { schedules: true }
      })
    ]);

    if (!requester || !group) {
      return notFound('Group not found or no access');
    }

    if (!target || !targetUser) {
      return notFound('Member not found');
    }

    const requesterName = requesterUser?.displayName ?? 'Someone';
    const now = new Date();
    const dueSchedules = group.schedules
      .filter((schedule) => hasScheduleStarted(schedule, now))
      .map((schedule) => ({
        schedule,
        dateKey: getLocalParts(now, schedule.timezone).dateKey
      }));

    if (!dueSchedules.length) {
      return badRequest('There are no check-ins due yet.');
    }

    const completedCheckins = await prisma.checkin.findMany({
      where: {
        id: {
          in: dueSchedules.map(({ schedule, dateKey }) => `${schedule.id}_${uid}_${dateKey}`)
        },
        status: 'completed'
      },
      select: { id: true }
    });
    const completedIds = new Set(completedCheckins.map((checkin) => checkin.id));
    const overdueSchedules = dueSchedules.filter(
      ({ schedule, dateKey }) => !completedIds.has(`${schedule.id}_${uid}_${dateKey}`)
    );

    if (!overdueSchedules.length) {
      return badRequest(`${targetUser.displayName} is already caught up.`);
    }

    const scheduleNames = overdueSchedules.map(({ schedule }) => schedule.name).join(', ');

    await Promise.all([
      sendPushToUser(
        uid,
        'SquadGoals poke',
        `${requesterName} poked you in ${group.name}. You still have ${scheduleNames} to finish.`
      ),
      postSystemMessage(groupId, `${requesterName} poked ${targetUser.displayName} to finish ${scheduleNames}. 👀`)
    ]);

    return ok({ message: 'Poke sent' });
  } catch (err) {
    return handleError(err);
  }
}
