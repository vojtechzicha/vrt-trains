import Link from 'next/link';
import { Station } from '@/types';
import { Card, CardBody, Badge } from '@/components/ui';

interface StationCardProps {
  station: Station;
  memberCount?: number;
  showCountry?: boolean;
}

const typeColors: Record<string, { bg: string; text: string }> = {
  hub: { bg: 'bg-purple-100', text: 'text-purple-800' },
  terminal: { bg: 'bg-blue-100', text: 'text-blue-800' },
  regular: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-200' },
  airport: { bg: 'bg-green-100', text: 'text-green-800' },
  request: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
};

export function StationCard({ station, memberCount, showCountry }: StationCardProps) {
  const colors = typeColors[station.type] || typeColors.regular;
  const isVirtual = station.isVirtual;
  const displayCountry = showCountry && station.country && station.country !== 'Czech';

  return (
    <Link href={`/stations/${station.id}`}>
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isVirtual ? 'ring-2 ring-amber-200' : ''}`}>
        <CardBody className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
            isVirtual
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            {isVirtual ? (
              <span className="text-lg">🏙</span>
            ) : (
              station.code
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{station.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {isVirtual ? (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  City Station
                </span>
              ) : (
                <>
                  <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text} capitalize`}>
                    {station.type}
                  </span>
                  {displayCountry && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {station.country}
                    </span>
                  )}
                </>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {isVirtual && memberCount !== undefined
                  ? `${memberCount} station${memberCount !== 1 ? 's' : ''}`
                  : `${station.platforms.length} platform${station.platforms.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
