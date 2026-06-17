import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, handleError, ok } from '@/lib/response';

// POST /api/auth/phone/send-otp  { phone: "+15551234567" }
// Sends a 6-digit OTP via SMS (Twilio). API key configured via TWILIO_* env vars.
// If Twilio is not configured the OTP is returned in the response (dev mode only).
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { phone?: string };
    const raw = body.phone?.trim() ?? '';

    if (!raw.match(/^\+?[1-9]\d{6,14}$/)) {
      return badRequest('Invalid phone number. Use E.164 format, e.g. +15551234567');
    }

    const phone = raw.startsWith('+') ? raw : `+${raw}`;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Upsert a stub user keyed by phone (email will be phone@phone.invalid until they set it)
    await prisma.user.upsert({
      where: { phone },
      update: { phoneOtp: otp, phoneOtpExpires: expires },
      create: {
        phone,
        displayName: phone,
        email: `${phone.replace(/\D/g, '')}@phone.invalid`,
        emailVerified: true,
        phoneOtp: otp,
        phoneOtpExpires: expires
      }
    });

    // Send via Twilio if configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (accountSid && authToken && from) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const body = new URLSearchParams({
        To: phone,
        From: from,
        Body: `Your SquadGoals code: ${otp}`
      });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        console.error('Twilio error:', err);
        return badRequest('Failed to send SMS. Check Twilio configuration.');
      }

      return ok({ sent: true });
    }

    // Dev mode: return OTP in response (remove in production)
    if (process.env.NODE_ENV !== 'production') {
      return ok({ sent: true, devOtp: otp });
    }

    return badRequest('SMS provider not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.');
  } catch (err) {
    return handleError(err);
  }
}
