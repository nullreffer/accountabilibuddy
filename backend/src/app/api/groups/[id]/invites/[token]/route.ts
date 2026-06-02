import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { forbidden, handleError, noContent, notFound } from '@/lib/response';

type RouteContext = { params: Promise<{ id: string; token: string }> };

// DELETE /api/groups/[id]/invites/[token]
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId, token } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'coowner')) {
      return forbidden();
    }

    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.groupId !== groupId) return notFound();

    await prisma.invite.delete({ where: { token } });
    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
