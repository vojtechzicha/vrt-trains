import { NextRequest, NextResponse } from 'next/server';
import { getStation, getVariantsByStation, getLines, getStations } from '@/lib/data';
import { updateMultipleVariantPlatforms } from '@/lib/data/variants';
import { aggregatePlatformData } from '@/lib/platforms';

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

    const variants = await getVariantsByStation(id);
    const allLines = await getLines();
    const allStations = await getStations();

    // Create station lookup for route descriptions
    const stationMap = new Map(allStations.map((s) => [s.id, s]));

    // Filter to only lines that have variants at this station
    const lineIds = [...new Set(variants.map((v) => v.lineId))];
    const lines = allLines.filter((l) => lineIds.includes(l.id));

    const platformData = aggregatePlatformData(id, variants, lines);

    return NextResponse.json({
      station: {
        id: station.id,
        code: station.code,
        name: station.name,
        platforms: station.platforms,
      },
      platformData,
      variants: variants.map((v) => {
        // Get first and last station names for route description
        const firstStation = stationMap.get(v.stations[0]?.stationId);
        const lastStation = stationMap.get(v.stations[v.stations.length - 1]?.stationId);
        const routeDescription = firstStation && lastStation
          ? `${firstStation.name} → ${lastStation.name}`
          : v.name;

        return {
          id: v.id,
          code: v.code,
          name: v.name,
          lineId: v.lineId,
          direction: v.direction,
          platform: v.stations.find((s) => s.stationId === id)?.platform || '',
          routeDescription,
        };
      }),
      lines: lines.map((l) => ({
        id: l.id,
        identifier: l.identifier,
        name: l.name,
        color: l.color,
        textColor: l.textColor,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch platform data:', error);
    return NextResponse.json({ error: 'Failed to fetch platform data' }, { status: 500 });
  }
}

interface PlatformAssignment {
  variantId: string;
  platform: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stationId } = await params;
    const station = await getStation(stationId);
    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    const { assignments } = await request.json() as { assignments: PlatformAssignment[] };

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json({ error: 'Invalid assignments data' }, { status: 400 });
    }

    // Convert to the format expected by updateMultipleVariantPlatforms
    const updates = assignments.map((a) => ({
      variantId: a.variantId,
      stationId,
      platform: a.platform,
    }));

    await updateMultipleVariantPlatforms(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update platform assignments:', error);
    return NextResponse.json({ error: 'Failed to update platform assignments' }, { status: 500 });
  }
}
