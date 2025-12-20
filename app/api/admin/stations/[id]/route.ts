import { NextRequest, NextResponse } from 'next/server';
import { getStation, updateStation, deleteStation } from '@/lib/data';

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
