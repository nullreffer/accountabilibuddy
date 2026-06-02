import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleError, notFound, ok } from '@/lib/response';

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/invites/[token] — public, no auth required
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { group: true }
    });

    if (!invite) return notFound('Invite not found');
    if (invite.used) return notFound('This invite has already been used');
    if (invite.expiresAt < new Date()) return notFound('This invite has expired');

    return ok({
      token: invite.token,
      groupId: invite.groupId,
      groupName: invite.group.name,
      expiresAt: invite.expiresAt
    });
  } catch (err) {
    return handleError(err);
  }
}
