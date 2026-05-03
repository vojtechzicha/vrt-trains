'use client';

interface StationMarqueeProps {
  stations: string[];
  className?: string;
}

export function StationMarquee({ stations, className = '' }: StationMarqueeProps) {
  if (stations.length === 0) {
    return null;
  }

  const stationText = stations.join('  •  ');

  // For short lists, no animation needed
  if (stations.length <= 2) {
    return (
      <div className={`text-gray-500 dark:text-gray-400 text-sm truncate ${className}`}>
        {stationText}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <div
        className="animate-marquee-scroll flex w-max"
        style={{
          animationDuration: `${Math.max(stations.length * 1.5, 6)}s`,
        }}
      >
        <span className="whitespace-nowrap text-gray-500 dark:text-gray-400 text-sm">
          {stationText}
        </span>
        <span className="whitespace-nowrap text-gray-500 dark:text-gray-400 text-sm pl-12">
          {stationText}
        </span>
      </div>
    </div>
  );
}
