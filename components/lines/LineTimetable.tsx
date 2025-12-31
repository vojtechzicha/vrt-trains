import { Timetable, Variant, Station } from '@/types';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, OperatingDaysBadge } from '@/components/ui';
import { formatTime } from '@/lib/utils';
import { buildTimetableData } from '@/lib/timetable';

const countryFlags: Record<string, string> = {
  Czech: '🇨🇿',
  Germany: '🇩🇪',
  Austria: '🇦🇹',
  Poland: '🇵🇱',
  Slovakia: '🇸🇰',
  Hungary: '🇭🇺',
};

function getCountryFlag(country?: string): string {
  return countryFlags[country || 'Czech'] || '🏳️';
}

interface LineTimetableProps {
  variants: Variant[];
  timetables: Timetable[];
  stations: Station[];
}

export function LineTimetable({ variants, timetables, stations }: LineTimetableProps) {
  // Build timetable data using extracted logic
  const { stationOrder, entries } = buildTimetableData(variants, timetables);

  // Create station lookup
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No timetable data available
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 bg-gray-50 z-10">Station</TableHead>
          {entries.map((entry) => (
            <TableHead key={entry.trainNumber} className="text-center min-w-[80px] !normal-case">
              <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
                <span>{entry.variantCode}</span>
                <OperatingDaysBadge days={entry.operatingDays} />
              </div>
              <div className="font-mono">{entry.trainNumber}</div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {stationOrder.map((stationId, idx) => {
          const station = stationMap.get(stationId);
          if (!station) return null;

          // Check if this is a country crossing (country differs from previous station)
          const prevStationId = idx > 0 ? stationOrder[idx - 1] : null;
          const prevStation = prevStationId ? stationMap.get(prevStationId) : null;
          const currentCountry = station.country || 'Czech';
          const prevCountry = prevStation?.country || 'Czech';
          const isCountryCrossing = idx > 0 && currentCountry !== prevCountry;

          return (
            <TableRow key={stationId} className={isCountryCrossing ? 'border-t-2 border-t-amber-400' : ''}>
              <TableCell className="sticky left-0 bg-white z-10 font-medium">
                <span className="flex items-center gap-1.5">
                  {(isCountryCrossing || currentCountry !== 'Czech') && (
                    <span title={currentCountry}>{getCountryFlag(currentCountry)}</span>
                  )}
                  {station.name}
                </span>
              </TableCell>
              {entries.map((entry) => {
                const timeData = entry.times.get(stationId);
                if (!timeData) {
                  // Check if this station is between the train's first and last stop
                  const isPassingThrough = idx >= entry.firstStationIdx && idx <= entry.lastStationIdx;
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
      </TableBody>
    </Table>
  );
}
