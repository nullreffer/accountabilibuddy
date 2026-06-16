import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleError, notFound, ok } from '@/lib/response';

type RouteContext = { params: Promise<{ id: string }> };

const mapMember = (m: {
  userId: string;
  role: string;
  notificationsEnabled: boolean;
  joinedAt: Date;
  user: { displayName: string; email: string; photoUrl: string | null };
  starCount: number;
}) => ({
  uid: m.userId,
  role: m.role,
  notificationsEnabled: m.notificationsEnabled,
  joinedAt: m.joinedAt,
  displayName: m.user.displayName,
  email: m.user.email,
  photoURL: m.user.photoUrl ?? '',
  starCount: m.starCount
});

// GET /api/groups/[id]/members
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id } = await ctx.params;

    const myMembership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: id } }
    });
    if (!myMembership) return notFound('Group not found or no access');

    const members = await prisma.groupMember.findMany({
      where: { groupId: id },
      include: { user: true },
      orderBy: { joinedAt: 'asc' }
    });

    const starCounts = await prisma.checkin.groupBy({
      by: ['userId'],
      where: {
        groupId: id,
        status: 'completed'
      },
      _count: { _all: true }
    });
    const starCountByUser = new Map(starCounts.map((entry) => [entry.userId, entry._count._all]));
    const leaderboard = members
      .map((member) => ({
        ...member,
        starCount: starCountByUser.get(member.userId) ?? 0
      }))
      .sort((left, right) => {
        if (right.starCount !== left.starCount) {
          return right.starCount - left.starCount;
        }

        return left.joinedAt.getTime() - right.joinedAt.getTime();
      });

    return ok(leaderboard.map(mapMember));
  } catch (err) {
    return handleError(err);
  }
}
