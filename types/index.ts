// Station types
export type StationType = 'hub' | 'terminal' | 'regular' | 'airport' | 'request';

export interface Station {
  id: string;
  code: string;
  name: string;
  type: StationType;
  platforms: number;
  isTerminal: boolean;
  country?: string;  // defaults to "Czech"
  // Virtual station fields
  isVirtual?: boolean;
  memberStationIds?: string[];
}

// Line types
export type LineType = 'suburban' | 'regional' | 'intercity' | 'express' | 'local';

export interface Line {
  id: string;
  identifier: string;
  name: string;
  color: string;
  textColor: string;
  type: LineType;
  variants: string[];
}

// Variant types
export type StopType = 'regular' | 'request' | 'pass';
export type Direction = 'outbound' | 'inbound';
export type SpeedCategory = 'vrt' | 'fast' | 'slow';

export interface VariantStop {
  stationId: string;
  sequence: number;
  dwellTime: number;            // User-customizable dwell time in minutes
  platform: string;
  stopType: StopType;
}

// Calculated variant stop with timing offsets (computed from route, not stored)
export interface CalculatedVariantStop extends VariantStop {
  arrivalOffset: number | null;    // Cumulative minutes from start (null for first)
  departureOffset: number | null;  // Cumulative minutes from start (null for last)
  travelTimeFromPrevious: number;  // Minutes from previous stop (for display)
}

// Route corridor types
export interface RoutePathStop {
  stationId: string;
  sequence: number;
  distanceFromPrevious: number;   // Segment distance in km (user enters this)
  distanceKm: number;             // Cumulative distance from path start (auto-calculated)
  vrtTime?: number;               // VRT/high-speed time in minutes (at least one required)
  fastTime?: number;              // Fast train time in minutes
  slowTime?: number;              // Regional/slow train time in minutes
  defaultDwellTime: number;       // Default stop duration (minutes)
}

export interface ReverseTimeAdjustment {
  stationId: string;
  vrtTime?: number;               // VRT time when going in reverse
  fastTime?: number;              // Fast time when going in reverse
  slowTime?: number;              // Slow time when going in reverse
}

export interface RoutePath {
  id: string;
  name: string;                   // Freeform text, e.g., "via VRT", "via Jihlava"
  stops: RoutePathStop[];
  reverseTimeAdjustments?: ReverseTimeAdjustment[];
}

export interface RouteCorridor {
  id: string;
  name: string;                   // Freeform text, e.g., "Praha-Brno Corridor"
  description?: string;
  paths: RoutePath[];             // Multiple alternative paths through this corridor
  createdAt: string;
  updatedAt: string;
}

export interface VariantRouteRef {
  routeId: string;
  pathId: string;
  direction: Direction;
  speedCategory: SpeedCategory;   // Which speed times to use for this segment
  startStationId?: string;        // Where to join this route (optional subset)
  endStationId?: string;          // Where to leave this route (optional subset)
}

export interface Variant {
  id: string;
  lineId: string;
  code: string;
  name: string;
  direction: Direction;
  routeRefs: VariantRouteRef[];   // Required - one or more route references
  stations: VariantStop[];        // Actual stops with adjusted times
  outOfSync?: boolean;            // Flag when source route has changed
}

// Timetable types
export type OperatingDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'
  | 'weekdays'
  | 'weekends';

export interface TimetableDeparture {
  stationId: string;
  arrival: string | null;
  departure: string | null;
}

export interface Timetable {
  id: string;
  variantId: string;
  trainNumber: string;
  operatingDays: OperatingDay[];
  departures: TimetableDeparture[];
}

// Derived types for views
export interface DepartureInfo {
  time: string;
  lineId: string;
  lineIdentifier: string;
  lineColor: string;
  lineTextColor: string;
  variantCode: string;
  variantName: string;
  destination: string;
  platform: string;
  trainNumber: string;
  operatingDays: OperatingDay[];
  viaStations: string[];
  allStations: string[];
  // Virtual station source tracking
  fromStationId?: string;
  fromStationName?: string;
}

export interface StationWithLines extends Station {
  lines: Line[];
}

// Connection types for station direct connections
export interface LineConnection {
  lineId: string;
  lineIdentifier: string;
  lineColor: string;
  lineTextColor: string;
  travelTimeMinutes: number;
  trainsPerDay: number;
}

export interface DirectConnection {
  destinationStationId: string;
  destinationStationName: string;
  destinationStationCode: string;
  destinationType: StationType;
  isVirtual: boolean;
  lines: LineConnection[];
}

// Operating pattern types for auto-generated timetables
export interface OffPeakReduction {
  startTime: string;  // "09:00"
  endTime: string;    // "16:00"
}

export interface ServicePeriod {
  startTime: string;
  endTime: string;
  intervalMinutes: number;  // Minutes between trains (e.g., 60 = 1tph, 120 = 1 per 2h)
  offPeakReduction?: OffPeakReduction;
}

export interface OperatingPattern {
  id: string;
  name: string;
  periods: ServicePeriod[];
  operatingDays: OperatingDay[];
}

export interface ShortTurnConfig {
  startingStations: string[];  // Stations where morning trains can start
  endingStations: string[];    // Stations where evening trains can end
  generatedVariants: string[]; // IDs of auto-generated short variants
}

export interface VariantPairRef {
  outboundVariantId: string;
  inboundVariantId: string;
}

export interface LineSchedule {
  id: string;
  lineId: string;
  name: string;
  patternId: string;
  primaryPair: VariantPairRef;
  anchorStationId: string;
  outboundAnchorMinute: number;  // 0-59, departure minute at anchor station
  inboundAnchorMinute: number;
  trainNumberPrefix: string;
  startBaseNumber: number;
  shortTurnConfig?: ShortTurnConfig;
}

// Suggested short-turn variant (for confirmation UI)
export interface ShortTurnSuggestion {
  direction: Direction;
  startStationId: string;
  endStationId: string;
  purpose: 'morning-starter' | 'evening-terminator';
  trainsNeeded: number;
  timeRange: { start: string; end: string };
  suggestedCode: string;
  suggestedName: string;
}
