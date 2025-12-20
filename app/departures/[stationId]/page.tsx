import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStation, getVariantsByStation, getLines, getTimetables, getStations, getMemberStations } from '@/lib/data';
import { DepartureBoardWithTabs } from '@/components/departures';
import { DepartureInfo, Station, Line, Variant, Timetable } from '@/types';
import { compareTime } from '@/lib/utils';

interface DepartureBoardPageProps {
  params: Promise<{ stationId: string }>;
}

// Helper function to build departures for a single physical station
function buildDeparturesForStation(
  physicalStationId: string,
  variants: Variant[],
  allTimetables: Timetable[],
  lineMap: Map<string, Line>,
  stationMap: Map<string, Station>,
  fromStationName?: string
): DepartureInfo[] {
  const departures: DepartureInfo[] = [];
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  allTimetables.forEach((tt) => {
    const variant = variantMap.get(tt.variantId);
    if (!variant) return;

    const line = lineMap.get(variant.lineId);
    if (!line) return;

    const stopIndex = tt.departures.findIndex((d) => d.stationId === physicalStationId);
    if (stopIndex === -1) return;

    const stop = tt.departures[stopIndex];
    if (!stop.departure) return; // Skip if this is the terminal

    // Get destination (last station in this timetable)
    const lastStop = tt.departures[tt.departures.length - 1];
    const destStation = stationMap.get(lastStop.stationId);

    // Get hub stations after current stop (excluding destination)
    const remainingStops = tt.departures.slice(stopIndex + 1, -1);

    const viaStations = remainingStops
      .filter((d) => {
        const s = stationMap.get(d.stationId);
        return s?.type === 'hub';
      })
      .map((d) => stationMap.get(d.stationId)?.name || '');

    // Get ALL intermediate stations for marquee
    const allStationsNames = remainingStops
      .map((d) => stationMap.get(d.stationId)?.name || '')
      .filter(Boolean);

    // Get platform from variant (source of truth)
    const variantStop = variant.stations.find((s) => s.stationId === physicalStationId);
    const platform = variantStop?.platform || '';

    departures.push({
      time: stop.departure,
      lineId: line.id,
      lineIdentifier: line.identifier,
      lineColor: line.color,
      lineTextColor: line.textColor,
      variantCode: variant.code,
      variantName: variant.name,
      destination: destStation?.name || 'Unknown',
      platform,
      trainNumber: tt.trainNumber,
      operatingDays: tt.operatingDays,
      viaStations,
      allStations: allStationsNames,
      fromStationId: fromStationName ? physicalStationId : undefined,
      fromStationName,
    });
  });

  return departures;
}

export default async function DepartureBoardPage({ params }: DepartureBoardPageProps) {
  const { stationId } = await params;
  const station = await getStation(stationId);

  if (!station) {
    notFound();
  }

  const allLines = await getLines();
  const allTimetables = await getTimetables();
  const allStations = await getStations();

  const lineMap = new Map(allLines.map((l) => [l.id, l]));
  const stationMap = new Map(allStations.map((s) => [s.id, s]));

  let departures: DepartureInfo[] = [];

  if (station.isVirtual && station.memberStationIds) {
    // Virtual station: aggregate departures from all member stations
    const memberStations = await getMemberStations(stationId);

    for (const memberStation of memberStations) {
      const memberVariants = await getVariantsByStation(memberStation.id);
      const memberDepartures = buildDeparturesForStation(
        memberStation.id,
        memberVariants,
        allTimetables,
        lineMap,
        stationMap,
        memberStation.name // Pass the source station name
      );
      departures.push(...memberDepartures);
    }
  } else {
    // Physical station: build departures normally
    const variants = await getVariantsByStation(stationId);
    departures = buildDeparturesForStation(
      stationId,
      variants,
      allTimetables,
      lineMap,
      stationMap
    );
  }

  // Sort by departure time
  departures.sort((a, b) => compareTime(a.time, b.time));

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <Link href="/departures" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Stations
        </Link>
        <Link href={`/stations/${station.id}`} className="text-sm text-blue-600 hover:underline">
          View Station Details →
        </Link>
      </div>

      <DepartureBoardWithTabs
        stationName={station.name}
        departures={departures}
        platformCount={station.platforms}
        isVirtual={station.isVirtual || false}
      />
    </div>
  );
}
