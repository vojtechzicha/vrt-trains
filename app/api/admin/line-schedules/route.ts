import { NextRequest, NextResponse } from 'next/server';
import { getLineSchedules, createLineSchedule, getLineScheduleByLine } from '@/lib/data/lineSchedules';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get('lineId');

    if (lineId) {
      const schedule = await getLineScheduleByLine(lineId);
      return NextResponse.json(schedule || null);
    }

    const schedules = await getLineSchedules();
    return NextResponse.json(schedules);
  } catch (error) {
    console.error('Failed to fetch line schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch line schedules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.lineId || !data.name || !data.patternId || !data.primaryPair) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const schedule = await createLineSchedule(data);
    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error('Failed to create line schedule:', error);
    const message = error instanceof Error ? error.message : 'Failed to create line schedule';
    const status = message.includes('already exists') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
