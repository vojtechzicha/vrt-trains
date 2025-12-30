import { NextRequest, NextResponse } from 'next/server';
import { getLineSchedule, updateLineSchedule, deleteLineSchedule } from '@/lib/data/lineSchedules';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const schedule = await getLineSchedule(id);

    if (!schedule) {
      return NextResponse.json({ error: 'Line schedule not found' }, { status: 404 });
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Failed to fetch line schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch line schedule' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const data = await request.json();

    const schedule = await updateLineSchedule(id, data);
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Failed to update line schedule:', error);
    const message = error instanceof Error ? error.message : 'Failed to update line schedule';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteLineSchedule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete line schedule:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete line schedule';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
