import { NextRequest, NextResponse } from 'next/server';
import { getVariants, getVariantsByLine, createVariant, duplicateVariant } from '@/lib/data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get('lineId');

    const variants = lineId ? await getVariantsByLine(lineId) : await getVariants();
    return NextResponse.json(variants);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch variants' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Check if this is a duplicate request
    if (data.sourceId) {
      const variant = await duplicateVariant(data.sourceId, {
        code: data.code,
        name: data.name,
        truncateAtStationId: data.truncateAtStationId,
      });
      return NextResponse.json(variant, { status: 201 });
    }

    const variant = await createVariant(data);
    return NextResponse.json(variant, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create variant' }, { status: 500 });
  }
}
