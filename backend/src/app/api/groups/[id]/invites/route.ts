import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { created, forbidden, handleError, notFound, ok } from '@/lib/response';
import { sendInviteEmail } from '@/lib/email';

type RouteContext = { params: Promise<{ id: string }> };

const mapInvite = (inv: {
  token: string;
  groupId: string;
  createdBy: string;
  email: string | null;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}) => ({
  token: inv.token,
  groupId: inv.groupId,
  createdBy: inv.createdBy,
  email: inv.email,
  createdAt: inv.createdAt,
  expiresAt: inv.expiresAt,
  used: inv.used
});

// GET /api/groups/[id]/invites
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'coowner')) {
      return forbidden();
    }

    const invites = await prisma.invite.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' }
    });

    return ok(invites.map(mapInvite));
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/groups/[id]/invites
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'coowner')) {
      return forbidden();
    }

    const body = (await req.json()) as { email?: string | null; sendEmail?: boolean };
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return notFound();

    const inviter = await prisma.user.findUnique({ where: { id: userId } });
    if (!inviter) return notFound('User not found');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.invite.create({
      data: {
        groupId,
        createdBy: userId,
        email: body.email ?? null,
        expiresAt
      }
    });

    const appUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const inviteUrl = `${appUrl}/join/${invite.token}`;

    if (body.email && body.sendEmail) {
      await sendInviteEmail({
        to: body.email,
        groupName: group.name,
        inviteUrl,
        inviterName: inviter.displayName
      }).catch((e) => console.error('Email send error', e));
    }

    return created({ ...mapInvite(invite), inviteUrl });
  } catch (err) {
    return handleError(err);
  }
}
