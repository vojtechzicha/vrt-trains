'use client';

interface RouteStop {
  stationName: string;
  stationCode: string;
  cumulativeMinutes: number;
  platform: string;
}

interface RoutePreviewProps {
  stops: RouteStop[];
}

export function RoutePreview({ stops }: RoutePreviewProps) {
  if (stops.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        Add stations to see route preview
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {stops.map((stop, index) => (
        <div key={index} className="flex items-stretch">
          {/* Line and dot */}
          <div className="flex flex-col items-center mr-3">
            <div
              className={`w-3 h-3 rounded-full border-2 ${
                index === 0 || index === stops.length - 1
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-white border-gray-400'
              }`}
            />
            {index < stops.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-300 min-h-[24px]" />
            )}
          </div>

          {/* Station info */}
          <div className="flex-1 pb-4">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-gray-900 text-sm">
                {stop.stationName}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                {stop.stationCode}
              </span>
            </div>
            <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
              <span>{stop.cumulativeMinutes} min</span>
              <span>Plt {stop.platform}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
