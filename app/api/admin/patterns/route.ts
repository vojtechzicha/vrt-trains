import { NextRequest, NextResponse } from 'next/server';
import { getPatterns, createPattern } from '@/lib/data/lineSchedules';

export async function GET() {
  try {
    const patterns = await getPatterns();
    return NextResponse.json(patterns);
  } catch (error) {
    console.error('Failed to fetch patterns:', error);
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.name || !data.periods || !data.operatingDays) {
      return NextResponse.json(
        { error: 'Missing required fields: name, periods, operatingDays' },
        { status: 400 }
      );
    }

    // Validate periods
    if (!Array.isArray(data.periods) || data.periods.length === 0) {
      return NextResponse.json(
        { error: 'Pattern must have at least one period' },
        { status: 400 }
      );
    }

    const pattern = await createPattern(data);
    return NextResponse.json(pattern, { status: 201 });
  } catch (error) {
    console.error('Failed to create pattern:', error);
    return NextResponse.json({ error: 'Failed to create pattern' }, { status: 500 });
  }
}
