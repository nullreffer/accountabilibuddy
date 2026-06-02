import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, forbidden, handleError, notFound } from '@/lib/response';

type RouteContext = { params: Promise<{ id: string; checkinId: string }> };

// POST /api/groups/[id]/checkins/[checkinId]/photo — upload/replace photo for a checkin
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId, checkinId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership) return forbidden();

    const checkin = await prisma.checkin.findUnique({ where: { id: checkinId } });
    if (!checkin || checkin.groupId !== groupId) return notFound();
    if (checkin.userId !== userId) return forbidden('Cannot upload photo for another user');

    const formData = await req.formData();
    const file = formData.get('photo') as File | null;
    if (!file) return badRequest('photo file is required');

    const uploadsDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `${groupId}_${checkinId}_${Date.now()}.jpg`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(uploadsDir, filename), buffer);

    await prisma.checkin.update({ where: { id: checkinId }, data: { photoUrl: filename } });

    return NextResponse.json({
      photoURL: `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/files/${filename}`
    });
  } catch (err) {
    return handleError(err);
  }
}
