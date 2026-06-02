import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { forbidden, handleError, noContent, notFound, ok } from '@/lib/response';

type RouteContext = { params: Promise<{ id: string; uid: string }> };

// PATCH /api/groups/[id]/members/[uid]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const requestingUserId = requireAuth(req);
    const { id: groupId, uid } = await ctx.params;

    const requester = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: requestingUserId, groupId } }
    });
    if (!requester || (requester.role !== 'owner' && requester.role !== 'coowner')) {
      return forbidden();
    }

    const body = (await req.json()) as { role?: string; notificationsEnabled?: boolean };

    // A member can update their own notification preference only
    const isSelf = requestingUserId === uid;
    if (isSelf && body.role !== undefined) {
      return forbidden('You cannot change your own role');
    }

    const target = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: uid, groupId } }
    });
    if (!target) return notFound('Member not found');

    // Only the owner can promote/demote
    if (body.role !== undefined && requester.role !== 'owner') {
      return forbidden('Only the owner can change roles');
    }

    const updated = await prisma.groupMember.update({
      where: { userId_groupId: { userId: uid, groupId } },
      data: {
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.notificationsEnabled !== undefined
          ? { notificationsEnabled: Boolean(body.notificationsEnabled) }
          : {})
      }
    });

    return ok({ uid, role: updated.role, notificationsEnabled: updated.notificationsEnabled });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/groups/[id]/members/[uid]
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const requestingUserId = requireAuth(req);
    const { id: groupId, uid } = await ctx.params;

    const requester = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: requestingUserId, groupId } }
    });

    // Allow self-removal or owner/coowner removing others
    const isSelfRemoval = requestingUserId === uid;
    if (!isSelfRemoval && (!requester || (requester.role !== 'owner' && requester.role !== 'coowner'))) {
      return forbidden();
    }

    const target = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: uid, groupId } }
    });
    if (!target) return notFound('Member not found');

    if (target.role === 'owner') {
      return forbidden('Cannot remove the group owner');
    }

    await prisma.groupMember.delete({ where: { userId_groupId: { userId: uid, groupId } } });
    await prisma.jar.deleteMany({ where: { userId: uid, groupId } });

    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
