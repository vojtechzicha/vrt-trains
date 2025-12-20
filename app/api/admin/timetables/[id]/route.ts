import { NextRequest, NextResponse } from 'next/server';
import { getTimetable, updateTimetable, deleteTimetable, isTrainNumberUnique } from '@/lib/data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const timetable = await getTimetable(id);
    if (!timetable) {
      return NextResponse.json({ error: 'Timetable not found' }, { status: 404 });
    }
    return NextResponse.json(timetable);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch timetable' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    // If train number is being updated, check uniqueness (excluding self)
    if (data.trainNumber) {
      const isUnique = await isTrainNumberUnique(data.trainNumber, id);
      if (!isUnique) {
        return NextResponse.json(
          { error: 'Train number already exists', code: 'DUPLICATE_TRAIN_NUMBER' },
          { status: 400 }
        );
      }
    }

    const timetable = await updateTimetable(id, data);
    return NextResponse.json(timetable);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update timetable' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTimetable(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete timetable' }, { status: 500 });
  }
}
