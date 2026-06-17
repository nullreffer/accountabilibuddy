import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, created, handleError, ok } from '@/lib/response';

const mapGroup = (group: {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: Date;
  photoProofRequired: boolean;
  jarEnabled: boolean;
  jarAmount: unknown;
  checkinType: string;
  _count?: { members: number };
}) => ({
  id: group.id,
  name: group.name,
  description: group.description,
  ownerId: group.ownerId,
  createdAt: group.createdAt,
  settings: {
    photoProofRequired: group.photoProofRequired,
    jarEnabled: group.jarEnabled,
    jarAmount: Number(group.jarAmount),
    checkinType: group.checkinType as 'standard' | 'timer'
  },
  memberCount: group._count?.members
});

// GET /api/groups — list groups for current user
export async function GET(req: NextRequest) {
  try {
    const userId = requireAuth(req);

    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: { include: { _count: { select: { members: true } } } }
      }
    });

    return ok(memberships.map((m) => mapGroup(m.group)));
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/groups — create a new group
export async function POST(req: NextRequest) {
  try {
    const userId = requireAuth(req);
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      photoProofRequired?: boolean;
      jarEnabled?: boolean;
      jarAmount?: number;
      checkinType?: string;
    };

    if (!body.name?.trim()) {
      return badRequest('name is required');
    }

    if (body.jarEnabled && Number(body.jarAmount) <= 0) {
      return badRequest('jarAmount must be greater than 0 when jar is enabled');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return badRequest('User not found');

    const group = await prisma.group.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() ?? '',
        ownerId: userId,
        photoProofRequired: Boolean(body.photoProofRequired),
        jarEnabled: Boolean(body.jarEnabled),
        jarAmount: body.jarEnabled ? Number(body.jarAmount) : 0,
        checkinType: body.checkinType ?? 'standard',
        members: {
          create: {
            userId,
            role: 'owner',
            notificationsEnabled: true
          }
        },
        jars: body.jarEnabled
          ? { create: { userId, count: 0, totalOwed: 0 } }
          : undefined
      },
      include: { _count: { select: { members: true } } }
    });

    return created(mapGroup(group));
  } catch (err) {
    return handleError(err);
  }
}
