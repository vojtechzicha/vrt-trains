import { NextRequest, NextResponse } from 'next/server';
import { getLine, updateLine, deleteLine } from '@/lib/data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const line = await getLine(id);
    if (!line) {
      return NextResponse.json({ error: 'Line not found' }, { status: 404 });
    }
    return NextResponse.json(line);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch line' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const line = await updateLine(id, data);
    return NextResponse.json(line);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update line' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteLine(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete line' }, { status: 500 });
  }
}
