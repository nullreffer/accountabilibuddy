import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleError, notFound, ok } from '@/lib/response';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/groups/[id]/jars
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership) return notFound('Group not found or no access');

    const jars = await prisma.jar.findMany({
      where: { groupId },
      include: { user: true },
      orderBy: { totalOwed: 'desc' }
    });

    return ok(
      jars.map((j) => ({
        uid: j.userId,
        count: j.count,
        totalOwed: Number(j.totalOwed),
        displayName: j.user.displayName
      }))
    );
  } catch (err) {
    return handleError(err);
  }
}
