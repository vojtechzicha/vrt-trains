import { Variant, Line, Direction, Platform } from '@/types';

export interface PlatformVariantInfo {
  variantId: string;
  variantCode: string;
  direction: Direction;
}

export interface PlatformLineInfo {
  lineId: string;
  lineIdentifier: string;
  lineColor: string;
  lineTextColor: string;
  lineName: string;
  variants: PlatformVariantInfo[];
}

export interface PlatformData {
  platform: string;
  platformName?: string;
  isBay?: boolean;
  lines: PlatformLineInfo[];
}

/**
 * Aggregates platform data for a station from variant information.
 * Groups variants by platform, then by line, tracking which directions use each platform.
 */
export function aggregatePlatformData(
  stationId: string,
  variants: Variant[],
  lines: Line[],
  stationPlatforms?: Platform[]
): PlatformData[] {
  // Create a map for platform metadata lookup
  const platformMetaMap = new Map(
    (stationPlatforms || []).map((p) => [p.code, p])
  );
  // Create a line lookup map
  const lineMap = new Map(lines.map((l) => [l.id, l]));

  // Map: platform -> lineId -> variants[]
  const platformLineMap = new Map<string, Map<string, PlatformVariantInfo[]>>();

  for (const variant of variants) {
    // Find the stop at this station
    const stop = variant.stations.find((s) => s.stationId === stationId);
    if (!stop) continue;

    const platform = stop.platform || 'unassigned';

    // Initialize platform map if needed
    if (!platformLineMap.has(platform)) {
      platformLineMap.set(platform, new Map());
    }

    const lineVariantsMap = platformLineMap.get(platform)!;

    // Initialize line variants array if needed
    if (!lineVariantsMap.has(variant.lineId)) {
      lineVariantsMap.set(variant.lineId, []);
    }

    lineVariantsMap.get(variant.lineId)!.push({
      variantId: variant.id,
      variantCode: variant.code,
      direction: variant.direction,
    });
  }

  // Convert to PlatformData array
  const platforms: PlatformData[] = [];

  // Sort platforms numerically (handle both numeric and string platforms)
  const sortedPlatforms = [...platformLineMap.keys()].sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    // Put 'unassigned' at the end
    if (a === 'unassigned') return 1;
    if (b === 'unassigned') return -1;
    return a.localeCompare(b);
  });

  for (const platform of sortedPlatforms) {
    const lineVariantsMap = platformLineMap.get(platform)!;
    const platformLines: PlatformLineInfo[] = [];

    for (const [lineId, variantInfos] of lineVariantsMap) {
      const line = lineMap.get(lineId);
      if (!line) continue;

      platformLines.push({
        lineId: line.id,
        lineIdentifier: line.identifier,
        lineColor: line.color,
        lineTextColor: line.textColor,
        lineName: line.name,
        variants: variantInfos,
      });
    }

    // Sort lines by identifier
    platformLines.sort((a, b) => a.lineIdentifier.localeCompare(b.lineIdentifier));

    // Get platform metadata
    const platformMeta = platformMetaMap.get(platform);

    platforms.push({
      platform,
      platformName: platformMeta?.name || undefined,
      isBay: platformMeta?.isBay || undefined,
      lines: platformLines,
    });
  }

  return platforms;
}

/**
 * Gets the platform for a specific variant at a station.
 */
export function getPlatformForVariantAtStation(
  variant: Variant,
  stationId: string
): string | null {
  const stop = variant.stations.find((s) => s.stationId === stationId);
  return stop?.platform ?? null;
}

/**
 * Checks if a line has different platforms for different directions at a station.
 */
export function hasMultiplePlatformsForLine(
  lineId: string,
  stationId: string,
  variants: Variant[]
): boolean {
  const lineVariants = variants.filter((v) => v.lineId === lineId);
  const platforms = new Set<string>();

  for (const variant of lineVariants) {
    const stop = variant.stations.find((s) => s.stationId === stationId);
    if (stop?.platform) {
      platforms.add(stop.platform);
    }
  }

  return platforms.size > 1;
}
