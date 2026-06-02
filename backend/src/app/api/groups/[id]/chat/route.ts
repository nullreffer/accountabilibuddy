import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, created, handleError, notFound, ok } from '@/lib/response';

type RouteContext = { params: Promise<{ id: string }> };

const mapMessage = (m: {
  id: string;
  groupId: string;
  userId: string | null;
  type: string;
  text: string;
  createdAt: Date;
  user: { displayName: string; photoUrl: string | null } | null;
}) => ({
  id: m.id,
  groupId: m.groupId,
  userId: m.userId,
  type: m.type,
  text: m.text,
  createdAt: m.createdAt,
  userDisplayName: m.user?.displayName ?? null,
  userPhotoURL: m.user?.photoUrl ?? null
});

// GET /api/groups/[id]/chat?limit=50&before=<id>
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership) return notFound('Group not found or no access');

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);
    const before = url.searchParams.get('before');

    const messages = await prisma.chatMessage.findMany({
      where: {
        groupId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {})
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return ok(messages.reverse().map(mapMessage));
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/groups/[id]/chat
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership) return notFound('Group not found or no access');

    const body = (await req.json()) as { text?: string };
    const text = body.text?.trim() ?? '';
    if (!text) return badRequest('Message text is required');
    if (text.length > 1000) return badRequest('Message too long (max 1000 characters)');

    const message = await prisma.chatMessage.create({
      data: { groupId, userId, type: 'message', text },
      include: { user: true }
    });

    return created(mapMessage(message));
  } catch (err) {
    return handleError(err);
  }
}
