import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, forbidden, handleError, ok } from '@/lib/response';
import { postSystemMessage } from '@/lib/chat';

type RouteContext = { params: Promise<{ id: string; uid: string }> };

// PATCH /api/groups/[id]/jars/[uid]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId, uid } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership || membership.role !== 'owner') {
      return forbidden('Only the owner can update jar contributions');
    }

    const body = (await req.json()) as { count?: number; totalOwed?: number };

    if (body.count !== undefined && (typeof body.count !== 'number' || body.count < 0)) {
      return badRequest('count must be a non-negative number');
    }
    if (body.totalOwed !== undefined && (typeof body.totalOwed !== 'number' || body.totalOwed < 0)) {
      return badRequest('totalOwed must be a non-negative number');
    }

    const jar = await prisma.jar.upsert({
      where: { userId_groupId: { userId: uid, groupId } },
      update: {
        ...(body.count !== undefined ? { count: body.count } : {}),
        ...(body.totalOwed !== undefined ? { totalOwed: body.totalOwed } : {})
      },
      create: {
        userId: uid,
        groupId,
        count: body.count ?? 0,
        totalOwed: body.totalOwed ?? 0
      }
    });

    // Post system chat message (non-blocking)
    Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.user.findUnique({ where: { id: uid } })
    ])
      .then(([actor, target]) => {
        if (!actor || !target) return;
        const parts: string[] = [];
        if (body.totalOwed !== undefined) {
          parts.push(`$${jar.totalOwed.toNumber().toFixed(2)} owed`);
        }
        if (body.count !== undefined) {
          parts.push(`${jar.count} miss${jar.count === 1 ? '' : 'es'}`);
        }
        const detail = parts.length ? ` (${parts.join(', ')})` : '';
        return postSystemMessage(
          groupId,
          `${actor.displayName} updated ${target.displayName}'s jar${detail}.`
        );
      })
      .catch((e) => console.error('Chat system message error', e));

    return ok({ uid, count: jar.count, totalOwed: Number(jar.totalOwed) });
  } catch (err) {
    return handleError(err);
  }
}
