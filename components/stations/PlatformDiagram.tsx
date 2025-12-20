import Link from 'next/link';
import { LineBadge } from '@/components/lines';
import { PlatformData } from '@/lib/platforms';

interface PlatformDiagramProps {
  platforms: PlatformData[];
  stationPlatformCount: number;
}

export function PlatformDiagram({ platforms, stationPlatformCount }: PlatformDiagramProps) {
  if (stationPlatformCount === 0) {
    return (
      <p className="text-gray-500">This station has no platforms</p>
    );
  }

  // Create array of all platform numbers (1 to platformCount)
  const allPlatforms = Array.from({ length: stationPlatformCount }, (_, i) => String(i + 1));

  // Create a map for quick lookup of platform data
  const platformDataMap = new Map(platforms.map((p) => [p.platform, p]));

  return (
    <div className="space-y-4">
      {allPlatforms.map((platformNumber) => {
        const platformData = platformDataMap.get(platformNumber);
        const hasLines = platformData && platformData.lines.length > 0;

        return (
          <div key={platformNumber} className="relative">
            {/* Platform label */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-medium text-gray-600 w-20">
                Platform {platformNumber}
              </span>
              {/* Platform track line */}
              <div className="flex-1 h-1 bg-gray-300 rounded" />
            </div>

            {/* Lines on this platform */}
            <div className="ml-20 pl-3">
              {hasLines ? (
                <div className="flex flex-wrap gap-2">
                  {platformData.lines.map((line) => {
                    // Check if this line has both directions on this platform
                    const hasInbound = line.variants.some((v) => v.direction === 'inbound');
                    const hasOutbound = line.variants.some((v) => v.direction === 'outbound');
                    const hasBothDirections = hasInbound && hasOutbound;

                    // If line has both directions on same platform, show single badge
                    // If only one direction, show direction indicator
                    if (hasBothDirections) {
                      return (
                        <Link key={line.lineId} href={`/lines/${line.lineId}`}>
                          <LineBadge
                            identifier={line.lineIdentifier}
                            color={line.lineColor}
                            textColor={line.lineTextColor}
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </Link>
                      );
                    }

                    // Show with direction indicator
                    const directionArrow = hasOutbound ? ' \u2192' : ' \u2190';
                    return (
                      <Link key={line.lineId} href={`/lines/${line.lineId}`}>
                        <span className="inline-flex items-center">
                          <LineBadge
                            identifier={line.lineIdentifier + directionArrow}
                            color={line.lineColor}
                            textColor={line.lineTextColor}
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">
                  No scheduled services
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
