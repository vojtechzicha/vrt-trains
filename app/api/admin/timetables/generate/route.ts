import { NextRequest, NextResponse } from 'next/server';
import { getVariant, generateTimetables, deleteTimetablesByVariant } from '@/lib/data';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { variantId, firstDeparture, interval, endTime, operatingDays, trainNumberPrefix, startBaseNumber, clearExisting } = data;

    const variant = await getVariant(variantId);
    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    // Clear existing timetables for this variant if requested
    if (clearExisting) {
      await deleteTimetablesByVariant(variantId);
    }

    const timetables = await generateTimetables({
      variant,
      firstDeparture,
      interval,
      endTime,
      operatingDays,
      trainNumberPrefix,
      startBaseNumber: startBaseNumber || 100,
    });

    return NextResponse.json(timetables, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate timetables' }, { status: 500 });
  }
}
