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

export interface VariantStop {
  stationId: string;
  sequence: number;
  arrivalOffset: number | null;
  departureOffset: number | null;
  platform: string;
  stopType: StopType;
}

export interface Variant {
  id: string;
  lineId: string;
  code: string;
  name: string;
  direction: Direction;
  stations: VariantStop[];
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
  platform: string;
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
