import { NextRequest, NextResponse } from 'next/server';
import { getLines, createLine, getVariants } from '@/lib/data';

export async function GET() {
  try {
    const [lines, variants] = await Promise.all([getLines(), getVariants()]);

    // Add actual variant count to each line
    const linesWithCounts = lines.map((line) => ({
      ...line,
      variantCount: variants.filter((v) => v.lineId === line.id).length,
    }));

    return NextResponse.json(linesWithCounts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch lines' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const line = await createLine(data);
    return NextResponse.json(line, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create line' }, { status: 500 });
  }
}
