import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, created, handleError, notFound, ok } from '@/lib/response';
import { sendPushToGroup } from '@/lib/push';
import { postSystemMessage } from '@/lib/chat';
import path from 'path';
import fs from 'fs/promises';

type RouteContext = { params: Promise<{ id: string }> };

const mapCheckin = (c: {
  id: string;
  userId: string;
  scheduleId: string;
  date: string;
  completedAt: Date;
  photoUrl: string | null;
  status: string;
  user: { displayName: string; photoUrl: string | null };
}) => ({
  id: c.id,
  uid: c.userId,
  scheduleId: c.scheduleId,
  date: c.date,
  completedAt: c.completedAt,
  photoURL: c.photoUrl
    ? `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/files/${c.photoUrl}`
    : null,
  status: c.status,
  userDisplayName: c.user.displayName,
  userPhotoURL: c.user.photoUrl ?? ''
});

// GET /api/groups/[id]/checkins?limit=20&dateRange=7d
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership) return notFound('Group not found or no access');

    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const dateRange = url.searchParams.get('dateRange') as '7d' | '30d' | 'all' | null;

    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    let dateFilter: { gte?: Date } | undefined;
    if (dateRange && dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);
      dateFilter = { gte: startDate };
    }

    const checkins = await prisma.checkin.findMany({
      where: {
        groupId,
        ...(dateFilter ? { completedAt: dateFilter } : {})
      },
      include: { user: true },
      orderBy: { completedAt: dateRange ? 'asc' : 'desc' },
      ...(limit > 0 && !dateRange ? { take: limit } : {})
    });

    return ok(checkins.map(mapCheckin));
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/groups/[id]/checkins
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership) return notFound('Group not found or no access');

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return notFound();

    // Handle multipart (photo upload) or JSON
    let scheduleId: string;
    let photoRelPath: string | null = null;

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      scheduleId = (formData.get('scheduleId') as string | null) ?? 'manual';
      const file = formData.get('photo') as File | null;

      if (group.photoProofRequired && !file) {
        return badRequest('Photo proof required for this group');
      }

      if (file) {
        const uploadsDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        const filename = `${groupId}_${userId}_${Date.now()}.jpg`;
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(path.join(uploadsDir, filename), buffer);
        photoRelPath = filename;
      }
    } else {
      const body = (await req.json()) as { scheduleId?: string };
      scheduleId = body.scheduleId ?? 'manual';

      if (group.photoProofRequired) {
        return badRequest('Photo proof required – use multipart/form-data');
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const checkinId = `${scheduleId}_${userId}_${today}`;

    const existing = await prisma.checkin.findUnique({ where: { id: checkinId } });
    if (existing?.status === 'completed') {
      return badRequest('Already checked in for this schedule today');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return notFound('User not found');

    const checkin = await prisma.checkin.upsert({
      where: { id: checkinId },
      update: {
        completedAt: new Date(),
        photoUrl: photoRelPath,
        status: 'completed'
      },
      create: {
        id: checkinId,
        userId,
        groupId,
        scheduleId,
        date: today,
        completedAt: new Date(),
        photoUrl: photoRelPath,
        status: 'completed'
      },
      include: { user: true }
    });

    // Fire push notification (non-blocking)
    sendPushToGroup(
      groupId,
      'Check-in completed',
      `${user.displayName} completed their check-in in ${group.name}!`,
      { groupId, type: 'checkin' }
    ).catch((e) => console.error('Push error', e));

    // Post system chat message (non-blocking)
    postSystemMessage(groupId, `${user.displayName} just completed their check-in! 🎉`).catch(
      (e) => console.error('Chat system message error', e)
    );

    return created(mapCheckin(checkin));
  } catch (err) {
    return handleError(err);
  }
}
