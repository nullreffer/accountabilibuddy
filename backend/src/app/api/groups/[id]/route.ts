import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, forbidden, handleError, noContent, notFound, ok } from '@/lib/response';

type RouteContext = { params: Promise<{ id: string }> };

const mapGroup = (group: {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: Date;
  photoProofRequired: boolean;
  jarEnabled: boolean;
  jarAmount: unknown;
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
    jarAmount: Number(group.jarAmount)
  },
  memberCount: group._count?.members
});

// GET /api/groups/[id]
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: id } }
    });
    if (!membership) return notFound('Group not found or no access');

    const group = await prisma.group.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } }
    });
    if (!group) return notFound();

    return ok({ ...mapGroup(group), role: membership.role });
  } catch (err) {
    return handleError(err);
  }
}

// PATCH /api/groups/[id]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: id } }
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'coowner')) {
      return forbidden();
    }

    const body = (await req.json()) as {
      name?: string;
      description?: string;
      photoProofRequired?: boolean;
      jarEnabled?: boolean;
      jarAmount?: number;
    };

    if (body.name !== undefined && !body.name.trim()) {
      return badRequest('name cannot be empty');
    }

    const updated = await prisma.group.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description.trim() } : {}),
        ...(body.photoProofRequired !== undefined ? { photoProofRequired: Boolean(body.photoProofRequired) } : {}),
        ...(body.jarEnabled !== undefined ? { jarEnabled: Boolean(body.jarEnabled) } : {}),
        ...(body.jarAmount !== undefined ? { jarAmount: Number(body.jarAmount) } : {})
      },
      include: { _count: { select: { members: true } } }
    });

    return ok(mapGroup(updated));
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/groups/[id]
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: id } }
    });
    if (!membership || membership.role !== 'owner') {
      return forbidden('Only the owner can delete the group');
    }

    await prisma.group.delete({ where: { id } });
    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
