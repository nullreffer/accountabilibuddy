import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

type RouteContext = { params: Promise<{ filename: string }> };

// GET /api/files/[filename] — serve uploaded files
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { filename } = await ctx.params;

  // Prevent path traversal
  const safe = path.basename(filename);
  const uploadsDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads');
  const filePath = path.join(uploadsDir, safe);

  try {
    const buffer = await fs.readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
