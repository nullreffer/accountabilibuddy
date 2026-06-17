import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

const BYDAY_MAP = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Convert HH:MM + IANA timezone → UTC Date on the next upcoming target day */
function nextOccurrenceUtc(
  time: string,
  timezone: string,
  daysOfWeek: number[],
  frequency: string
): Date {
  const [h, m] = time.split(':').map(Number);
  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  const todayDow = nowInTz.getDay();

  let daysAhead = 0;
  if (frequency === 'daily') {
    daysAhead = 0;
  } else if (frequency === 'monthly') {
    // Use daysOfWeek[0] as the day-of-month
    const targetDom = daysOfWeek[0] ?? 1;
    const currentDom = nowInTz.getDate();
    daysAhead = targetDom >= currentDom ? targetDom - currentDom : 30 - currentDom + targetDom;
  } else {
    // weekly / custom — find the next listed day of week
    const sorted = [...daysOfWeek].sort((a, b) => a - b);
    const future = sorted.find((d) => d >= todayDow);
    const targetDow = future !== undefined ? future : sorted[0] ?? todayDow;
    daysAhead = (targetDow - todayDow + 7) % 7;
  }

  const targetLocal = new Date(nowInTz);
  targetLocal.setDate(targetLocal.getDate() + daysAhead);
  targetLocal.setHours(h, m, 0, 0);

  // Convert local target date back to UTC
  // Build "YYYY-MM-DDTHH:MM:00" string for target timezone
  const pad = (n: number) => String(n).padStart(2, '0');
  const localStr = `${targetLocal.getFullYear()}-${pad(targetLocal.getMonth() + 1)}-${pad(targetLocal.getDate())}T${pad(h)}:${pad(m)}:00`;

  // Use the timezone offset trick to get UTC
  const tentativeUtc = new Date(localStr + 'Z'); // treats as UTC
  const localEquiv = new Date(tentativeUtc.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = tentativeUtc.getTime() - localEquiv.getTime();
  return new Date(tentativeUtc.getTime() + offsetMs);
}

function icsDatetime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildRrule(frequency: string, daysOfWeek: number[]): string {
  switch (frequency) {
    case 'daily':
      return 'RRULE:FREQ=DAILY';
    case 'monthly': {
      const dom = daysOfWeek[0] ?? 1;
      return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dom}`;
    }
    case 'weekly':
    case 'custom':
    default: {
      const byDay = daysOfWeek.map((d) => BYDAY_MAP[d]).join(',');
      return byDay ? `RRULE:FREQ=WEEKLY;BYDAY=${byDay}` : 'RRULE:FREQ=DAILY';
    }
  }
}

function escapeIcs(str: string): string {
  return str.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

// GET /api/groups/[id]/schedules/ics
// Auth via Authorization header (regular fetch) OR ?token=JWT (webcal subscription)
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    // Support token via query param for webcal:// subscriptions
    const url = new URL(req.url);
    const queryToken = url.searchParams.get('token');
    let userId = getUserIdFromRequest(req);

    if (!userId && queryToken) {
      // Inline verification for query param token
      const { verifyToken } = await import('@/lib/auth');
      try {
        const payload = verifyToken(queryToken);
        userId = payload.sub;
      } catch {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }

    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { id: groupId } = await ctx.params;

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } }
    });
    if (!membership) return new NextResponse('Not found', { status: 404 });

    const [group, schedules] = await Promise.all([
      prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
      prisma.schedule.findMany({ where: { groupId }, orderBy: { createdAt: 'asc' } })
    ]);

    if (!group) return new NextResponse('Not found', { status: 404 });

    const now = new Date();
    const dtstamp = icsDatetime(now);

    const events = schedules.map((s) => {
      const dtstart = icsDatetime(
        nextOccurrenceUtc(s.time, s.timezone, s.daysOfWeek, s.frequency)
      );
      const rrule = buildRrule(s.frequency, s.daysOfWeek);

      return [
        'BEGIN:VEVENT',
        `UID:${s.id}@squad-goals`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        rrule,
        `SUMMARY:${escapeIcs(s.name)}`,
        `DESCRIPTION:SquadGoals group check-in reminder`,
        'BEGIN:VALARM',
        'TRIGGER:-PT5M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcs(s.name)} — time to check in!`,
        'END:VALARM',
        'END:VEVENT'
      ].join('\r\n');
    });

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//SquadGoals//Schedules//EN`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeIcs(group.name)} – SquadGoals`,
      'X-WR-CALDESC:Check-in reminders from SquadGoals',
      ...events,
      'END:VCALENDAR'
    ].join('\r\n');

    const filename = `${group.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-schedules.ics`;

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    console.error(err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
