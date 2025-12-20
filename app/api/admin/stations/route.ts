import { NextRequest, NextResponse } from 'next/server';
import { getStations, createStation } from '@/lib/data';

export async function GET() {
  try {
    const stations = await getStations();
    return NextResponse.json(stations);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const station = await createStation(data);
    return NextResponse.json(station, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create station' }, { status: 500 });
  }
}
