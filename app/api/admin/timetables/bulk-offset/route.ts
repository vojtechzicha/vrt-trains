import { NextRequest, NextResponse } from 'next/server';
import { bulkOffsetTimetables } from '@/lib/data';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { variantIds, offsetMinutes } = data;

    if (!Array.isArray(variantIds) || variantIds.length === 0) {
      return NextResponse.json({ error: 'variantIds must be a non-empty array' }, { status: 400 });
    }

    if (typeof offsetMinutes !== 'number' || offsetMinutes === 0) {
      return NextResponse.json({ error: 'offsetMinutes must be a non-zero number' }, { status: 400 });
    }

    const updated = await bulkOffsetTimetables(variantIds, offsetMinutes);

    return NextResponse.json({ updated }, { status: 200 });
  } catch (error) {
    console.error('Failed to bulk offset timetables:', error);
    return NextResponse.json({ error: 'Failed to bulk offset timetables' }, { status: 500 });
  }
}
