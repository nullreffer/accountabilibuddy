import { NextResponse } from 'next/server';
import { AuthError } from './auth';

export const ok = <T>(data: T) => NextResponse.json(data);

export const created = <T>(data: T) => NextResponse.json(data, { status: 201 });

export const noContent = () => new NextResponse(null, { status: 204 });

export const handleError = (err: unknown) => {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  console.error(err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
};

export const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

export const notFound = (message = 'Not found') =>
  NextResponse.json({ error: message }, { status: 404 });

export const forbidden = (message = 'Forbidden') =>
  NextResponse.json({ error: message }, { status: 403 });
