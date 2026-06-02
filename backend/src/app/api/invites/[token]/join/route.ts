import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, handleError, notFound, ok } from '@/lib/response';

type RouteContext = { params: Promise<{ token: string }> };

// POST /api/invites/[token]/join
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { token } = await ctx.params;

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { group: true }
    });

    if (!invite) return notFound('Invite not found');
    if (invite.used) return badRequest('This invite has already been used');
    if (invite.expiresAt < new Date()) return badRequest('This invite has expired');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return notFound('User not found');

    // Check if already a member
    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: invite.groupId } }
    });

    if (!existing) {
      await prisma.groupMember.create({
        data: {
          userId,
          groupId: invite.groupId,
          role: 'member',
          notificationsEnabled: true
        }
      });

      if (invite.group.jarEnabled) {
        await prisma.jar.upsert({
          where: { userId_groupId: { userId, groupId: invite.groupId } },
          update: {},
          create: { userId, groupId: invite.groupId, count: 0, totalOwed: 0 }
        });
      }
    }

    await prisma.invite.update({ where: { token }, data: { used: true } });

    return ok({ groupId: invite.groupId });
  } catch (err) {
    return handleError(err);
  }
}
