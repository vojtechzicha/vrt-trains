import { NextRequest, NextResponse } from 'next/server';
import { getTimetables, getTimetablesByVariant, getTimetablesByVariants, createTimetable, isTrainNumberUnique } from '@/lib/data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get('variantId');
    const variantIds = searchParams.get('variantIds');

    let timetables;
    if (variantIds) {
      // Multiple variant IDs (comma-separated)
      const ids = variantIds.split(',').filter(Boolean);
      timetables = await getTimetablesByVariants(ids);
    } else if (variantId) {
      // Single variant ID
      timetables = await getTimetablesByVariant(variantId);
    } else {
      // All timetables
      timetables = await getTimetables();
    }
    return NextResponse.json(timetables);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch timetables' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate train number uniqueness
    const isUnique = await isTrainNumberUnique(data.trainNumber);
    if (!isUnique) {
      return NextResponse.json(
        { error: 'Train number already exists', code: 'DUPLICATE_TRAIN_NUMBER' },
        { status: 400 }
      );
    }

    const timetable = await createTimetable(data);
    return NextResponse.json(timetable, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create timetable' }, { status: 500 });
  }
}
