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

    // Validate unique station code
    if (data.code) {
      const stations = await getStations();
      const existing = stations.find(s => s.code === data.code);
      if (existing) {
        return NextResponse.json(
          { error: `Station code "${data.code}" is already used by "${existing.name}"` },
          { status: 400 }
        );
      }
    }

    const station = await createStation(data);
    return NextResponse.json(station, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create station' }, { status: 500 });
  }
}
