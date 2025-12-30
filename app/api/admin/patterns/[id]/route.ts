import { NextRequest, NextResponse } from 'next/server';
import { getPattern, updatePattern, deletePattern } from '@/lib/data/lineSchedules';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const pattern = await getPattern(id);

    if (!pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
    }

    return NextResponse.json(pattern);
  } catch (error) {
    console.error('Failed to fetch pattern:', error);
    return NextResponse.json({ error: 'Failed to fetch pattern' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const data = await request.json();

    const pattern = await updatePattern(id, data);
    return NextResponse.json(pattern);
  } catch (error) {
    console.error('Failed to update pattern:', error);
    const message = error instanceof Error ? error.message : 'Failed to update pattern';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deletePattern(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete pattern:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete pattern';
    const status = message.includes('used by') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
