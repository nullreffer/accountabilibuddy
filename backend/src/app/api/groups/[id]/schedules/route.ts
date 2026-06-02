import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { created, forbidden, handleError, notFound, ok } from '@/lib/response';

type RouteContext = { params: Promise<{ id: string }> };

const mapSchedule = (s: {
  id: string;
  name: string;
  frequency: string;
  daysOfWeek: number[];
  time: string;
  timezone: string;
  createdAt: Date;
}) => ({
  id: s.id,
  name: s.name,
  frequency: s.frequency,
  daysOfWeek: s.daysOfWeek,
  time: s.time,
  timezone: s.timezone,
  createdAt: s.createdAt
});

// GET /api/groups/[id]/schedules
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = requireAuth(req);
    const { id: groupId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership) return notFound('Group not found or no access');

    const schedules = await prisma.schedule.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' }
    });

    return ok(schedules.map(mapSchedule));
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/groups/[id]/schedules
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

    const body = (await req.json()) as {
      name?: string;
      frequency?: string;
      daysOfWeek?: number[];
      time?: string;
      timezone?: string;
    };

    const schedule = await prisma.schedule.create({
      data: {
        groupId,
        name: body.name ?? 'Schedule',
        frequency: body.frequency ?? 'daily',
        daysOfWeek: body.daysOfWeek ?? [],
        time: body.time ?? '09:00',
        timezone: body.timezone ?? 'UTC'
      }
    });

    return created(mapSchedule(schedule));
  } catch (err) {
    return handleError(err);
  }
}
