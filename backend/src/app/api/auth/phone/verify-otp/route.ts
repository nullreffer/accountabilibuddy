import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, handleError, ok } from '@/lib/response';
import { signToken } from '@/lib/auth';

// POST /api/auth/phone/verify-otp  { phone: "+15551234567", otp: "123456" }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { phone?: string; otp?: string };
    const phone = body.phone?.trim() ?? '';
    const otp = body.otp?.trim() ?? '';

    if (!phone || !otp) return badRequest('phone and otp are required');

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return NextResponse.json({ error: 'Unknown phone number' }, { status: 401 });

    if (
      !user.phoneOtp ||
      !user.phoneOtpExpires ||
      user.phoneOtp !== otp ||
      user.phoneOtpExpires < new Date()
    ) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 });
    }

    // Clear OTP after use
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneOtp: null, phoneOtpExpires: null }
    });

    const token = signToken({ sub: user.id, email: user.email });
    return ok({ token });
  } catch (err) {
    return handleError(err);
  }
}
