import { NextRequest, NextResponse } from 'next/server';
import { getStation, getStations, updateStation, deleteStation } from '@/lib/data';
import { validatePlatformCodes } from '@/lib/platforms/helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const station = await getStation(id);
    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }
    return NextResponse.json(station);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch station' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    // Validate unique station code (exclude current station)
    if (data.code) {
      const stations = await getStations();
      const existing = stations.find(s => s.code === data.code && s.id !== id);
      if (existing) {
        return NextResponse.json(
          { error: `Station code "${data.code}" is already used by "${existing.name}"` },
          { status: 400 }
        );
      }
    }

    // Validate platforms if provided
    if (data.platforms && Array.isArray(data.platforms)) {
      const validationError = validatePlatformCodes(data.platforms);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    const station = await updateStation(id, data);
    return NextResponse.json(station);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update station' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteStation(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete station' }, { status: 500 });
  }
}
