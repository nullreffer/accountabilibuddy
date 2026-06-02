import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { forbidden, handleError, noContent, notFound } from '@/lib/response';

type RouteContext = { params: Promise<{ id: string; scheduleId: string }> };

// DELETE /api/groups/[id]/schedules/[scheduleId]
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId, scheduleId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'coowner')) {
      return forbidden();
    }

    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule || schedule.groupId !== groupId) return notFound();

    await prisma.schedule.delete({ where: { id: scheduleId } });
    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
