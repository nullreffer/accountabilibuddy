import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { forbidden, handleError, ok } from '@/lib/response';

type RouteContext = { params: Promise<{ id: string; uid: string }> };

// POST /api/groups/[id]/jars/[uid]/reset
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId, uid } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership || membership.role !== 'owner') {
      return forbidden('Only the owner can reset jars');
    }

    const jar = await prisma.jar.upsert({
      where: { userId_groupId: { userId: uid, groupId } },
      update: { count: 0, totalOwed: 0 },
      create: { userId: uid, groupId, count: 0, totalOwed: 0 }
    });

    return ok({ uid, count: jar.count, totalOwed: Number(jar.totalOwed) });
  } catch (err) {
    return handleError(err);
  }
}
