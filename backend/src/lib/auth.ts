import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const SECRET = process.env.JWT_SECRET;

if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required');
}

const jwtSecret = SECRET ?? 'dev-secret-change-me';

export interface JwtPayload {
  sub: string; // user id
  email: string;
}

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, jwtSecret, { expiresIn: '30d' });

export const verifyToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, jwtSecret);
  if (typeof decoded === 'string' || !decoded.sub || !decoded.email) {
    throw new Error('Invalid token');
  }
  return decoded as JwtPayload;
};

export const getUserIdFromRequest = (req: NextRequest): string | null => {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return payload.sub;
  } catch {
    return null;
  }
};

export const requireAuth = (req: NextRequest): string => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    throw new AuthError('Unauthorized');
  }
  return userId;
};

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
