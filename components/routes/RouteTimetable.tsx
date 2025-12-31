import { RouteCorridor, Variant, Timetable, Station, Line } from '@/types';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Card, CardHeader, CardBody, ScrollableContainer, OperatingDaysBadge } from '@/components/ui';
import { formatTime } from '@/lib/utils';
import { buildRouteTimetableData, RouteTimetableEntry } from '@/lib/timetable';
import { LineBadge } from '@/components/lines';

const countryFlags: Record<string, string> = {
  Czech: '',
  Germany: '',
  Austria: '',
  Poland: '',
  Slovakia: '',
  Hungary: '',
};

function getCountryFlag(country?: string): string {
  return countryFlags[country || 'Czech'] || '';
}

interface DirectionTableProps {
  entries: RouteTimetableEntry[];
  stationOrder: string[];
  stationMap: Map<string, Station>;
  directionLabel: string;
  variantCodes: string[];
  reversed?: boolean;
}

function DirectionTable({ entries, stationOrder, stationMap, directionLabel, variantCodes, reversed = false }: DirectionTableProps) {
  const hasOrigins = entries.some((e) => e.entersFromOutside);
  const hasDestinations = entries.some((e) => e.continuesBeyond);

  // For reversed (inbound) direction, reverse the station display order
  const displayStationOrder = reversed ? [...stationOrder].reverse() : stationOrder;
  const n = stationOrder.length;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{directionLabel}</h2>
        <p className="text-sm text-gray-500">
          Variants: {variantCodes.join(', ')}
        </p>
      </CardHeader>
      <CardBody className="p-0">
        <ScrollableContainer>
          <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-gray-50 z-10">Station</TableHead>
            {entries.map((entry) => (
              <TableHead key={entry.trainNumber} className="text-center min-w-[80px] !normal-case">
                <div className="flex flex-col items-center gap-0.5">
                  <LineBadge
                    identifier={entry.lineIdentifier}
                    color={entry.lineColor}
                    textColor={entry.lineTextColor}
                    className="text-xs px-1.5 py-0.5"
                  />
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>{entry.variantCode}</span>
                    <OperatingDaysBadge days={entry.operatingDays} />
                  </div>
                  <div className="font-medium font-mono">{entry.trainNumber}</div>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Origin row - shows where trains come from if they enter this route from outside */}
          {hasOrigins && (
            <TableRow className="bg-gray-50">
              <TableCell className="sticky left-0 bg-gray-50 z-10 text-gray-500 italic text-sm">
                From
              </TableCell>
              {entries.map((entry) => (
                <TableCell key={entry.trainNumber} className="text-center text-xs text-gray-400">
                  {entry.entersFromOutside ? entry.originStationName : '-'}
                </TableCell>
              ))}
            </TableRow>
          )}

          {/* Station rows */}
          {displayStationOrder.map((stationId, idx) => {
            const station = stationMap.get(stationId);
            if (!station) return null;

            // Check if this is a country crossing
            const prevStationId = idx > 0 ? displayStationOrder[idx - 1] : null;
            const prevStation = prevStationId ? stationMap.get(prevStationId) : null;
            const currentCountry = station.country || 'Czech';
            const prevCountry = prevStation?.country || 'Czech';
            const isCountryCrossing = idx > 0 && currentCountry !== prevCountry;

            return (
              <TableRow
                key={stationId}
                className={isCountryCrossing ? 'border-t-2 border-t-amber-400' : ''}
              >
                <TableCell className="sticky left-0 bg-white z-10 font-medium">
                  <span className="flex items-center gap-1.5">
                    {(isCountryCrossing || currentCountry !== 'Czech') &&
                      getCountryFlag(currentCountry) && (
                        <span title={currentCountry}>{getCountryFlag(currentCountry)}</span>
                      )}
                    {station.name}
                  </span>
                </TableCell>
                {entries.map((entry) => {
                  const timeData = entry.times.get(stationId);
                  if (!timeData) {
                    // Check if this station is between the train's first and last stop
                    // For reversed order, we need to map indices: reversedIdx = (n-1) - originalIdx
                    const displayFirstIdx = reversed
                      ? (n - 1) - entry.lastStationIdx
                      : entry.firstStationIdx;
                    const displayLastIdx = reversed
                      ? (n - 1) - entry.firstStationIdx
                      : entry.lastStationIdx;
                    const isPassingThrough =
                      idx >= displayFirstIdx && idx <= displayLastIdx;
                    return (
                      <TableCell key={entry.trainNumber} className="text-center text-gray-300">
                        {isPassingThrough ? '|' : '-'}
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell key={entry.trainNumber} className="text-center">
                      {timeData.arrival && timeData.departure ? (
                        <div>
                          <div className="text-xs text-gray-400">{formatTime(timeData.arrival)}</div>
                          <div className="font-medium">{formatTime(timeData.departure)}</div>
                        </div>
                      ) : (
                        <div className="font-medium">
                          {formatTime(timeData.departure || timeData.arrival)}
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}

          {/* Destination row - shows where trains continue to if they leave this route */}
          {hasDestinations && (
            <TableRow className="bg-gray-50">
              <TableCell className="sticky left-0 bg-gray-50 z-10 text-gray-500 italic text-sm">
                To
              </TableCell>
              {entries.map((entry) => (
                <TableCell key={entry.trainNumber} className="text-center text-xs text-gray-400">
                  {entry.continuesBeyond ? entry.destinationStationName : '-'}
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
          </Table>
        </ScrollableContainer>
      </CardBody>
    </Card>
  );
}

interface RouteTimetableProps {
  route: RouteCorridor;
  variants: Variant[];
  timetables: Timetable[];
  stations: Station[];
  lines: Line[];
}

export function RouteTimetable({
  route,
  variants,
  timetables,
  stations,
  lines,
}: RouteTimetableProps) {
  // Build timetable data using route-specific logic
  const { stationOrder, outboundEntries, inboundEntries } = buildRouteTimetableData(
    route,
    variants,
    timetables,
    stations,
    lines
  );

  // Create station lookup
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  // Get endpoint names for direction labels
  const firstStation = stationOrder.length > 0 ? stationMap.get(stationOrder[0]) : null;
  const lastStation = stationOrder.length > 0 ? stationMap.get(stationOrder[stationOrder.length - 1]) : null;

  const outboundLabel = firstStation && lastStation
    ? `${firstStation.name} → ${lastStation.name}`
    : 'Outbound';
  const inboundLabel = firstStation && lastStation
    ? `${lastStation.name} → ${firstStation.name}`
    : 'Inbound';

  const hasOutbound = outboundEntries.length > 0;
  const hasInbound = inboundEntries.length > 0;

  // Get unique variant codes for each direction
  const outboundVariantCodes = [...new Set(outboundEntries.map((e) => e.variantCode))];
  const inboundVariantCodes = [...new Set(inboundEntries.map((e) => e.variantCode))];

  if (!hasOutbound && !hasInbound) {
    return (
      <div className="text-center py-8 text-gray-500">No scheduled trains on this route</div>
    );
  }

  return (
    <div className="space-y-8">
      {hasOutbound && (
        <DirectionTable
          entries={outboundEntries}
          stationOrder={stationOrder}
          stationMap={stationMap}
          directionLabel={outboundLabel}
          variantCodes={outboundVariantCodes}
        />
      )}
      {hasInbound && (
        <DirectionTable
          entries={inboundEntries}
          stationOrder={stationOrder}
          stationMap={stationMap}
          directionLabel={inboundLabel}
          variantCodes={inboundVariantCodes}
          reversed
        />
      )}
    </div>
  );
}
