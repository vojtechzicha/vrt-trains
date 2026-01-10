import { describe, it, expect } from 'vitest';
import {
  buildPathOrderingConstraints,
  buildRoutePathStationOrder,
  determineTrainContinuation,
  buildRouteTimetableData,
  calculatePathDistance,
  calculatePathTime,
  getRouteEndpoints,
} from './buildRouteTimetableData';
import { RoutePath, RouteCorridor, Variant, Timetable, Station, Line } from '@/types';

// Helper to create a RoutePath
function createPath(
  id: string,
  name: string,
  stops: { stationId: string; sequence: number; distanceKm?: number; baseTimeFromPrevious?: number }[]
): RoutePath {
  return {
    id,
    name,
    stops: stops.map((s) => ({
      stationId: s.stationId,
      sequence: s.sequence,
      distanceFromPrevious: 0,
      distanceKm: s.distanceKm || 0,
      baseTimeFromPrevious: s.baseTimeFromPrevious || 0,
      defaultDwellTime: 1,
    })),
  };
}

// Helper to create a minimal Variant
function createVariant(
  id: string,
  lineId: string,
  stationIds: string[],
  direction: 'outbound' | 'inbound' = 'outbound'
): Variant {
  return {
    id,
    lineId,
    code: 'TEST',
    name: 'Test Variant',
    direction,
    routeRefs: [],
    stations: stationIds.map((stationId, idx) => ({
      stationId,
      sequence: idx + 1,
      arrivalOffset: idx === 0 ? null : idx * 10,
      departureOffset: idx === stationIds.length - 1 ? null : idx * 10,
      platform: '1',
      stopType: 'regular' as const,
    })),
  };
}

// Helper to create a Timetable
function createTimetable(
  trainNumber: string,
  variantId: string,
  departures: { stationId: string; departure?: string; arrival?: string }[]
): Timetable {
  return {
    id: `tt-${trainNumber}`,
    variantId,
    trainNumber,
    operatingDays: ['monday'],
    departures: departures.map((d) => ({
      stationId: d.stationId,
      arrival: d.arrival || null,
      departure: d.departure || null,
    })),
  };
}

// Helper to create a Station
function createStation(id: string, name: string): Station {
  return {
    id,
    code: id.substring(0, 3).toUpperCase(),
    name,
    type: 'regular',
    platforms: 2,
  };
}

// Helper to create a Line
function createLine(id: string, identifier: string): Line {
  return {
    id,
    identifier,
    name: `Line ${identifier}`,
    color: '#0066cc',
    textColor: '#ffffff',
    type: 'regional',
    variants: [],
  };
}

describe('buildPathOrderingConstraints', () => {
  it('builds constraints for a single path', () => {
    const paths = [
      createPath('p1', 'Path 1', [
        { stationId: 'A', sequence: 1 },
        { stationId: 'B', sequence: 2 },
        { stationId: 'C', sequence: 3 },
      ]),
    ];

    const constraints = buildPathOrderingConstraints(paths);

    expect(constraints.get('A')?.has('B')).toBe(true);
    expect(constraints.get('A')?.has('C')).toBe(true);
    expect(constraints.get('B')?.has('C')).toBe(true);
    expect(constraints.get('C')?.size).toBe(0);
  });

  it('merges constraints from multiple paths', () => {
    const paths = [
      createPath('p1', 'Path 1', [
        { stationId: 'A', sequence: 1 },
        { stationId: 'B', sequence: 2 },
      ]),
      createPath('p2', 'Path 2', [
        { stationId: 'B', sequence: 1 },
        { stationId: 'C', sequence: 2 },
      ]),
    ];

    const constraints = buildPathOrderingConstraints(paths);

    expect(constraints.get('A')?.has('B')).toBe(true);
    expect(constraints.get('B')?.has('C')).toBe(true);
  });
});

describe('buildRoutePathStationOrder', () => {
  it('returns empty array for no paths', () => {
    expect(buildRoutePathStationOrder([])).toEqual([]);
  });

  it('returns station order for a single path', () => {
    const paths = [
      createPath('p1', 'Path 1', [
        { stationId: 'A', sequence: 1 },
        { stationId: 'B', sequence: 2 },
        { stationId: 'C', sequence: 3 },
      ]),
    ];

    expect(buildRoutePathStationOrder(paths)).toEqual(['A', 'B', 'C']);
  });

  it('merges two paths with common endpoints', () => {
    // Path 1: Praha -> Jihlava -> Brno
    // Path 2: Praha -> HavlBrod -> Brno
    const paths = [
      createPath('p1', 'via Jihlava', [
        { stationId: 'Praha', sequence: 1 },
        { stationId: 'Jihlava', sequence: 2 },
        { stationId: 'Brno', sequence: 3 },
      ]),
      createPath('p2', 'via HavlBrod', [
        { stationId: 'Praha', sequence: 1 },
        { stationId: 'HavlBrod', sequence: 2 },
        { stationId: 'Brno', sequence: 3 },
      ]),
    ];

    const order = buildRoutePathStationOrder(paths);

    // Both endpoints should be preserved
    expect(order[0]).toBe('Praha');
    expect(order[order.length - 1]).toBe('Brno');

    // Both intermediate stations should be present
    expect(order).toContain('Jihlava');
    expect(order).toContain('HavlBrod');

    // All stations should be between endpoints
    expect(order.indexOf('Jihlava')).toBeGreaterThan(0);
    expect(order.indexOf('Jihlava')).toBeLessThan(order.length - 1);
    expect(order.indexOf('HavlBrod')).toBeGreaterThan(0);
    expect(order.indexOf('HavlBrod')).toBeLessThan(order.length - 1);
  });

  it('handles paths with partial overlap', () => {
    // Path 1: A -> B -> C -> D
    // Path 2: B -> C -> E
    const paths = [
      createPath('p1', 'Full', [
        { stationId: 'A', sequence: 1 },
        { stationId: 'B', sequence: 2 },
        { stationId: 'C', sequence: 3 },
        { stationId: 'D', sequence: 4 },
      ]),
      createPath('p2', 'Short', [
        { stationId: 'B', sequence: 1 },
        { stationId: 'C', sequence: 2 },
        { stationId: 'E', sequence: 3 },
      ]),
    ];

    const order = buildRoutePathStationOrder(paths);

    // Verify ordering constraints
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'));
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('E'));

    // All stations present
    expect(order).toContain('A');
    expect(order).toContain('B');
    expect(order).toContain('C');
    expect(order).toContain('D');
    expect(order).toContain('E');
  });

  it('uses longest path as base', () => {
    const paths = [
      createPath('p1', 'Short', [
        { stationId: 'A', sequence: 1 },
        { stationId: 'C', sequence: 2 },
      ]),
      createPath('p2', 'Long', [
        { stationId: 'A', sequence: 1 },
        { stationId: 'B', sequence: 2 },
        { stationId: 'C', sequence: 3 },
      ]),
    ];

    const order = buildRoutePathStationOrder(paths);

    // Should use the longer path's order
    expect(order).toEqual(['A', 'B', 'C']);
  });
});

describe('determineTrainContinuation', () => {
  const stationMap = new Map([
    ['Praha', createStation('Praha', 'Praha hl.n.')],
    ['Brno', createStation('Brno', 'Brno hl.n.')],
    ['Ostrava', createStation('Ostrava', 'Ostrava hl.n.')],
    ['Olomouc', createStation('Olomouc', 'Olomouc hl.n.')],
  ]);

  it('returns no continuation for train entirely within route', () => {
    const routeStationIds = new Set(['Praha', 'Brno']);
    const variant = createVariant('v1', 'l1', ['Praha', 'Brno']);

    const result = determineTrainContinuation(variant, routeStationIds, stationMap);

    expect(result.entersFromOutside).toBe(false);
    expect(result.continuesBeyond).toBe(false);
    expect(result.origin).toBeUndefined();
    expect(result.destination).toBeUndefined();
  });

  it('detects train entering from outside', () => {
    // Train goes Praha -> Brno -> Ostrava, but route is only Brno -> Ostrava
    const routeStationIds = new Set(['Brno', 'Ostrava']);
    const variant = createVariant('v1', 'l1', ['Praha', 'Brno', 'Ostrava']);

    const result = determineTrainContinuation(variant, routeStationIds, stationMap);

    expect(result.entersFromOutside).toBe(true);
    expect(result.continuesBeyond).toBe(false);
    expect(result.origin?.id).toBe('Praha');
    expect(result.destination).toBeUndefined();
  });

  it('detects train continuing beyond route', () => {
    // Train goes Praha -> Brno -> Ostrava, but route is only Praha -> Brno
    const routeStationIds = new Set(['Praha', 'Brno']);
    const variant = createVariant('v1', 'l1', ['Praha', 'Brno', 'Ostrava']);

    const result = determineTrainContinuation(variant, routeStationIds, stationMap);

    expect(result.entersFromOutside).toBe(false);
    expect(result.continuesBeyond).toBe(true);
    expect(result.origin).toBeUndefined();
    expect(result.destination?.id).toBe('Ostrava');
  });

  it('detects train entering and continuing', () => {
    // Train goes Olomouc -> Praha -> Brno -> Ostrava, route is Praha -> Brno
    const routeStationIds = new Set(['Praha', 'Brno']);
    const variant = createVariant('v1', 'l1', ['Olomouc', 'Praha', 'Brno', 'Ostrava']);

    const result = determineTrainContinuation(variant, routeStationIds, stationMap);

    expect(result.entersFromOutside).toBe(true);
    expect(result.continuesBeyond).toBe(true);
    expect(result.origin?.id).toBe('Olomouc');
    expect(result.destination?.id).toBe('Ostrava');
  });

  it('handles empty variant', () => {
    const routeStationIds = new Set(['Praha', 'Brno']);
    const variant = createVariant('v1', 'l1', []);

    const result = determineTrainContinuation(variant, routeStationIds, stationMap);

    expect(result.entersFromOutside).toBe(false);
    expect(result.continuesBeyond).toBe(false);
  });

  it('handles variant with no overlap', () => {
    const routeStationIds = new Set(['Praha', 'Brno']);
    const variant = createVariant('v1', 'l1', ['Ostrava', 'Olomouc']);

    const result = determineTrainContinuation(variant, routeStationIds, stationMap);

    expect(result.entersFromOutside).toBe(false);
    expect(result.continuesBeyond).toBe(false);
  });
});

describe('buildRouteTimetableData', () => {
  const stations: Station[] = [
    createStation('Praha', 'Praha hl.n.'),
    createStation('Brno', 'Brno hl.n.'),
    createStation('Ostrava', 'Ostrava hl.n.'),
  ];

  const lines: Line[] = [createLine('l1', 'R10')];

  it('returns empty results for route with no paths', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Empty Route',
      paths: [],
      createdAt: '',
      updatedAt: '',
    };

    const result = buildRouteTimetableData(route, [], [], stations, lines);

    expect(result.stationOrder).toEqual([]);
    expect(result.outboundEntries).toEqual([]);
    expect(result.inboundEntries).toEqual([]);
  });

  it('builds timetable data for simple route (defaults to outbound)', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Brno',
      paths: [
        createPath('p1', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Variant without routeRefs defaults to outbound
    const variant = createVariant('v1', 'l1', ['Praha', 'Brno']);
    const timetable = createTimetable('R101', 'v1', [
      { stationId: 'Praha', departure: '08:00' },
      { stationId: 'Brno', arrival: '10:00' },
    ]);

    const result = buildRouteTimetableData(route, [variant], [timetable], stations, lines);

    expect(result.stationOrder).toEqual(['Praha', 'Brno']);
    expect(result.outboundEntries).toHaveLength(1);
    expect(result.inboundEntries).toHaveLength(0);
    expect(result.outboundEntries[0].trainNumber).toBe('R101');
    expect(result.outboundEntries[0].lineIdentifier).toBe('R10');
    expect(result.outboundEntries[0].entersFromOutside).toBe(false);
    expect(result.outboundEntries[0].continuesBeyond).toBe(false);
    expect(result.outboundEntries[0].routeDirection).toBe('outbound');
  });

  it('includes continuation info for extending trains', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Brno',
      paths: [
        createPath('p1', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Variant continues to Ostrava
    const variant = createVariant('v1', 'l1', ['Praha', 'Brno', 'Ostrava']);
    const timetable = createTimetable('R101', 'v1', [
      { stationId: 'Praha', departure: '08:00' },
      { stationId: 'Brno', arrival: '10:00', departure: '10:02' },
      { stationId: 'Ostrava', arrival: '12:00' },
    ]);

    const result = buildRouteTimetableData(route, [variant], [timetable], stations, lines);

    expect(result.outboundEntries).toHaveLength(1);
    expect(result.outboundEntries[0].continuesBeyond).toBe(true);
    expect(result.outboundEntries[0].destinationStationName).toBe('Ostrava hl.n.');

    // Only shows times for stations in route
    expect(result.outboundEntries[0].times.has('Praha')).toBe(true);
    expect(result.outboundEntries[0].times.has('Brno')).toBe(true);
    expect(result.outboundEntries[0].times.has('Ostrava')).toBe(false);
  });

  it('filters out timetables with no overlap with route', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Brno',
      paths: [
        createPath('p1', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    // This variant doesn't go through Praha or Brno
    const variant = createVariant('v1', 'l1', ['Ostrava']);
    const timetable = createTimetable('R101', 'v1', [
      { stationId: 'Ostrava', departure: '08:00' },
    ]);

    const result = buildRouteTimetableData(route, [variant], [timetable], stations, lines);

    expect(result.outboundEntries).toHaveLength(0);
    expect(result.inboundEntries).toHaveLength(0);
  });

  it('sorts entries by departure time', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Brno',
      paths: [
        createPath('p1', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    const variant = createVariant('v1', 'l1', ['Praha', 'Brno']);

    const timetables = [
      createTimetable('R103', 'v1', [
        { stationId: 'Praha', departure: '10:00' },
        { stationId: 'Brno', arrival: '12:00' },
      ]),
      createTimetable('R101', 'v1', [
        { stationId: 'Praha', departure: '08:00' },
        { stationId: 'Brno', arrival: '10:00' },
      ]),
      createTimetable('R102', 'v1', [
        { stationId: 'Praha', departure: '09:00' },
        { stationId: 'Brno', arrival: '11:00' },
      ]),
    ];

    const result = buildRouteTimetableData(route, [variant], timetables, stations, lines);

    expect(result.outboundEntries.map((e) => e.trainNumber)).toEqual(['R101', 'R102', 'R103']);
  });

  it('sorts trains using different paths correctly by common station time', () => {
    // Route with two paths - one via PrahaVRT, one direct
    // Trains using different paths should still be sorted by time at common station (Brno)
    const extendedStations: Station[] = [
      createStation('Praha', 'Praha hl.n.'),
      createStation('PrahaVRT', 'Praha východ VRT'),
      createStation('Brno', 'Brno hl.n.'),
      createStation('Olomouc', 'Olomouc hl.n.'),
    ];

    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Olomouc',
      paths: [
        // Path via PrahaVRT (longer, will be base)
        createPath('p1', 'via VRT', [
          { stationId: 'PrahaVRT', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
          { stationId: 'Olomouc', sequence: 3 },
        ]),
        // Direct path
        createPath('p2', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Variant 1: via PrahaVRT (Ex1505, Ex1507)
    const variant1 = createVariant('v1', 'l1', ['PrahaVRT', 'Brno', 'Olomouc']);
    // Variant 2: direct via Praha (Ex161)
    const variant2 = createVariant('v2', 'l1', ['Praha', 'Brno', 'Olomouc']);

    const timetables = [
      // Ex1505: PrahaVRT 08:30 -> Brno 07:30 -> Olomouc 07:55
      createTimetable('Ex1505', 'v1', [
        { stationId: 'PrahaVRT', departure: '08:30' },
        { stationId: 'Brno', arrival: '07:30', departure: '07:30' },
        { stationId: 'Olomouc', arrival: '07:55' },
      ]),
      // Ex1507: PrahaVRT 09:30 -> Brno 08:30 -> Olomouc 08:55
      createTimetable('Ex1507', 'v1', [
        { stationId: 'PrahaVRT', departure: '09:30' },
        { stationId: 'Brno', arrival: '08:30', departure: '08:30' },
        { stationId: 'Olomouc', arrival: '08:55' },
      ]),
      // Ex161: Praha 06:15 -> Brno 07:18 -> Olomouc 09:27
      // At Brno, Ex161 (07:18) should come BEFORE Ex1505 (07:30)
      createTimetable('Ex161', 'v2', [
        { stationId: 'Praha', departure: '06:15' },
        { stationId: 'Brno', arrival: '07:15', departure: '07:18' },
        { stationId: 'Olomouc', arrival: '09:27' },
      ]),
    ];

    const result = buildRouteTimetableData(
      route,
      [variant1, variant2],
      timetables,
      extendedStations,
      lines
    );

    // At Brno: Ex161(07:18) < Ex1505(07:30) < Ex1507(08:30)
    // So order should be: Ex161, Ex1505, Ex1507
    const trainOrder = result.outboundEntries.map((e) => e.trainNumber);
    expect(trainOrder).toEqual(['Ex161', 'Ex1505', 'Ex1507']);
  });

  it('sorts trains correctly when initial best station excludes some trains', () => {
    // Bug reproduction: when most trains share one station (PrahaVRT) but one train (Ex161)
    // uses a different path, the insertion should still use the correct comparison station
    const extendedStations: Station[] = [
      createStation('PrahaVRT', 'Praha východ VRT'),
      createStation('Brno', 'Brno hl.n.'),
      createStation('Olomouc', 'Olomouc hl.n.'),
      createStation('Praha', 'Praha hl.n.'),
    ];

    const route: RouteCorridor = {
      id: 'r1',
      name: 'Test Route',
      paths: [
        // Path via PrahaVRT - most trains use this
        createPath('p1', 'via VRT', [
          { stationId: 'PrahaVRT', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
          { stationId: 'Olomouc', sequence: 3 },
        ]),
        // Alternative path via Praha - fewer trains
        createPath('p2', 'via Praha', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Olomouc', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    // 4 trains via PrahaVRT (to make PrahaVRT the "best station")
    const variant1 = createVariant('v1', 'l1', ['PrahaVRT', 'Brno', 'Olomouc']);
    // 1 train via Praha (doesn't have PrahaVRT or Brno)
    const variant2 = createVariant('v2', 'l1', ['Praha', 'Olomouc']);

    const timetables = [
      createTimetable('Ex1501', 'v1', [
        { stationId: 'PrahaVRT', departure: '06:30' },
        { stationId: 'Brno', departure: '05:30' },
        { stationId: 'Olomouc', arrival: '05:55' },
      ]),
      createTimetable('Ex1503', 'v1', [
        { stationId: 'PrahaVRT', departure: '07:30' },
        { stationId: 'Brno', departure: '06:30' },
        { stationId: 'Olomouc', arrival: '06:55' },
      ]),
      createTimetable('Ex1505', 'v1', [
        { stationId: 'PrahaVRT', departure: '08:30' },
        { stationId: 'Brno', departure: '07:30' },
        { stationId: 'Olomouc', arrival: '07:55' },
      ]),
      createTimetable('Ex1507', 'v1', [
        { stationId: 'PrahaVRT', departure: '09:30' },
        { stationId: 'Brno', departure: '08:30' },
        { stationId: 'Olomouc', arrival: '08:55' },
      ]),
      // Ex161 uses different path, only shares Olomouc with other trains
      // At Olomouc: Ex161 arrives at 07:18, which is between Ex1503(06:55) and Ex1505(07:55)
      createTimetable('Ex161', 'v2', [
        { stationId: 'Praha', departure: '06:15' },
        { stationId: 'Olomouc', arrival: '07:18' },
      ]),
    ];

    const result = buildRouteTimetableData(
      route,
      [variant1, variant2],
      timetables,
      extendedStations,
      lines
    );

    // At Olomouc: 05:55, 06:55, 07:18, 07:55, 08:55
    // Order should be: Ex1501, Ex1503, Ex161, Ex1505, Ex1507
    const trainOrder = result.outboundEntries.map((e) => e.trainNumber);
    expect(trainOrder).toEqual(['Ex1501', 'Ex1503', 'Ex161', 'Ex1505', 'Ex1507']);
  });

  it('sorts train correctly when common station is only shared with some sorted trains', () => {
    // Scenario: Ex1101 shares Vítkovice with Sp6055 but NOT with RJ123 or R2705
    // Order should be by first appearance time on route:
    // - Ex1101: 10:10 (Vítkovice)
    // - RJ123: 10:39 (Svinov)
    // - R2705: 11:41 (Svinov)
    // - Sp6055: 11:56 (Svinov)

    const routeStations = [
      createStation('Svinov', 'Ostrava-Svinov'),
      createStation('Vitkovice', 'Ostrava-Vítkovice'),
      createStation('Hlavni', 'Ostrava hlavní nádraží'),
      createStation('Havirov', 'Havířov'),
    ];

    const routeLines = [
      createLine('l1', 'Spr1'),
      createLine('l2', 'R27'),
      createLine('l3', 'Ex11'),
      createLine('l4', 'R60'),
    ];

    const route: RouteCorridor = {
      id: 'r1',
      name: 'Test Route',
      paths: [
        createPath('p1', 'Main', [
          { stationId: 'Svinov', sequence: 1 },
          { stationId: 'Vitkovice', sequence: 2 },
          { stationId: 'Hlavni', sequence: 3 },
          { stationId: 'Havirov', sequence: 4 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Spr1 variant: Svinov -> Hlavní (no Vítkovice)
    const variantSpr1 = createVariant('v-spr1', 'l1', ['Svinov', 'Hlavni']);
    // R27 variant: Svinov -> Hlavní (no Vítkovice)
    const variantR27 = createVariant('v-r27', 'l2', ['Svinov', 'Hlavni']);
    // Ex11 variant: Vítkovice -> Havířov (no Svinov, no Hlavní)
    const variantEx11 = createVariant('v-ex11', 'l3', ['Vitkovice', 'Havirov']);
    // R60 variant: Svinov -> Vítkovice -> Hlavní (has both)
    const variantR60 = createVariant('v-r60', 'l4', ['Svinov', 'Vitkovice', 'Hlavni']);

    const timetables = [
      // RJ123: Svinov 10:39, Hlavní 10:48
      createTimetable('RJ123', 'v-spr1', [
        { stationId: 'Svinov', departure: '10:39' },
        { stationId: 'Hlavni', arrival: '10:48' },
      ]),
      // R2705: Svinov 11:41, Hlavní 11:50
      createTimetable('R2705', 'v-r27', [
        { stationId: 'Svinov', departure: '11:41' },
        { stationId: 'Hlavni', arrival: '11:50' },
      ]),
      // Ex1101: Vítkovice 10:10, Havířov 10:22
      createTimetable('Ex1101', 'v-ex11', [
        { stationId: 'Vitkovice', departure: '10:10' },
        { stationId: 'Havirov', arrival: '10:22' },
      ]),
      // Sp6055: Svinov 11:56, Vítkovice 12:01, Hlavní 12:05
      createTimetable('Sp6055', 'v-r60', [
        { stationId: 'Svinov', departure: '11:56' },
        { stationId: 'Vitkovice', departure: '12:01' },
        { stationId: 'Hlavni', arrival: '12:05' },
      ]),
    ];

    const result = buildRouteTimetableData(
      route,
      [variantSpr1, variantR27, variantEx11, variantR60],
      timetables,
      routeStations,
      routeLines
    );

    // Order by first appearance time on route:
    // Ex1101 (10:10) < RJ123 (10:39) < R2705 (11:41) < Sp6055 (11:56)
    const trainOrder = result.outboundEntries.map((e) => e.trainNumber);
    expect(trainOrder).toEqual(['Ex1101', 'RJ123', 'R2705', 'Sp6055']);
  });

  it('sorts trains by secondary common station when they dont share the primary', () => {
    // Scenario: Praha is best station (4 trains), but Ex1501 and Ex255 don't have Praha
    // They share Olomouc (2 trains) - should be sorted by Olomouc time as secondary
    // Ex101-Ex104 have Praha AND Olomouc, so they get sorted first by Praha

    const routeStations = [
      createStation('Praha', 'Praha hlavní nádraží'),
      createStation('Olomouc', 'Olomouc hlavní nádraží'),
    ];

    const routeLines = [createLine('l1', 'Ex1'), createLine('l2', 'Ex2')];

    const route: RouteCorridor = {
      id: 'r1',
      name: 'Test Route',
      paths: [
        createPath('p1', 'Main', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Olomouc', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Variant 1: Praha -> Olomouc (full route)
    const variantFull = createVariant('v-full', 'l1', ['Praha', 'Olomouc']);
    // Variant 2: Olomouc only (no Praha)
    const variantShort = createVariant('v-short', 'l2', ['Olomouc']);

    const timetables = [
      // Ex101: Praha 04:30, Olomouc 06:00 (has BOTH primary and secondary)
      createTimetable('Ex101', 'v-full', [
        { stationId: 'Praha', departure: '04:30' },
        { stationId: 'Olomouc', arrival: '06:00' },
      ]),
      // Ex102: Praha 04:45, Olomouc 06:15 (has BOTH)
      createTimetable('Ex102', 'v-full', [
        { stationId: 'Praha', departure: '04:45' },
        { stationId: 'Olomouc', arrival: '06:15' },
      ]),
      // Ex103: Praha 05:00, Olomouc 06:30 (has BOTH)
      createTimetable('Ex103', 'v-full', [
        { stationId: 'Praha', departure: '05:00' },
        { stationId: 'Olomouc', arrival: '06:30' },
      ]),
      // Ex104: Praha 05:15, Olomouc 06:45 (has BOTH)
      createTimetable('Ex104', 'v-full', [
        { stationId: 'Praha', departure: '05:15' },
        { stationId: 'Olomouc', arrival: '06:45' },
      ]),
      // Ex255: Olomouc 06:02 (no Praha - secondary only)
      createTimetable('Ex255', 'v-short', [{ stationId: 'Olomouc', departure: '06:02' }]),
      // Ex1501: Olomouc 06:25 (no Praha - secondary only)
      createTimetable('Ex1501', 'v-short', [{ stationId: 'Olomouc', arrival: '06:25' }]),
    ];

    const result = buildRouteTimetableData(
      route,
      [variantFull, variantShort],
      timetables,
      routeStations,
      routeLines
    );

    const trainOrder = result.outboundEntries.map((e) => e.trainNumber);

    // Primary sorting by Praha (4 trains): Ex101, Ex102, Ex103, Ex104
    // Secondary sorting by Olomouc (2 trains): Ex255, Ex1501
    //
    // When merging secondary trains, they compare at common station (Olomouc):
    // - Ex255 (06:02) vs Ex101 (06:00): 06:02 > 06:00 -> after Ex101
    // - Ex255 (06:02) vs Ex102 (06:15): 06:02 < 06:15 -> before Ex102
    // So Ex255 goes between Ex101 and Ex102
    //
    // - Ex1501 (06:25) vs Ex255 (06:02): 06:25 > 06:02 -> after Ex255
    // - Ex1501 (06:25) vs Ex102 (06:15): 06:25 > 06:15 -> after Ex102
    // - Ex1501 (06:25) vs Ex103 (06:30): 06:25 < 06:30 -> before Ex103
    // So Ex1501 goes between Ex102 and Ex103
    expect(trainOrder).toEqual(['Ex101', 'Ex255', 'Ex102', 'Ex1501', 'Ex103', 'Ex104']);
  });

  it('correctly orders trains that pass through both primary and secondary stations', () => {
    // Simpler test: All 4 trains share Olomouc, so they all get sorted by Olomouc time
    // This tests that secondary-only trains interleave correctly with primary trains

    const routeStations = [
      createStation('Praha', 'Praha hlavní nádraží'),
      createStation('Olomouc', 'Olomouc hlavní nádraží'),
    ];

    const routeLines = [createLine('l1', 'Ex1'), createLine('l2', 'Ex2')];

    const route: RouteCorridor = {
      id: 'r1',
      name: 'Test Route',
      paths: [
        createPath('p1', 'Main', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Olomouc', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    const variantFull = createVariant('v-full', 'l1', ['Praha', 'Olomouc']);
    const variantOlomouc = createVariant('v-olomouc', 'l2', ['Olomouc']);

    const timetables = [
      // Ex101: Praha 04:30, Olomouc 06:10 (has BOTH)
      createTimetable('Ex101', 'v-full', [
        { stationId: 'Praha', departure: '04:30' },
        { stationId: 'Olomouc', arrival: '06:10' },
      ]),
      // Ex102: Praha 05:00, Olomouc 07:00 (has BOTH)
      createTimetable('Ex102', 'v-full', [
        { stationId: 'Praha', departure: '05:00' },
        { stationId: 'Olomouc', arrival: '07:00' },
      ]),
      // Ex255: Olomouc 06:02 (only Olomouc)
      createTimetable('Ex255', 'v-olomouc', [{ stationId: 'Olomouc', departure: '06:02' }]),
      // Ex1501: Olomouc 06:25 (only Olomouc)
      createTimetable('Ex1501', 'v-olomouc', [{ stationId: 'Olomouc', departure: '06:25' }]),
    ];

    const result = buildRouteTimetableData(
      route,
      [variantFull, variantOlomouc],
      timetables,
      routeStations,
      routeLines
    );

    const trainOrder = result.outboundEntries.map((e) => e.trainNumber);

    // All 4 trains share Olomouc (count=4), so Olomouc is the best station
    // Sorting by Olomouc time:
    // - Ex255: 06:02
    // - Ex101: 06:10
    // - Ex1501: 06:25
    // - Ex102: 07:00
    expect(trainOrder).toEqual(['Ex255', 'Ex101', 'Ex1501', 'Ex102']);
  });
});

describe('buildRouteTimetableData direction splitting', () => {
  const stations: Station[] = [
    createStation('Praha', 'Praha hl.n.'),
    createStation('Brno', 'Brno hl.n.'),
    createStation('Ostrava', 'Ostrava hl.n.'),
  ];

  const lines: Line[] = [createLine('l1', 'R10')];

  // Helper to create a variant with routeRefs
  function createVariantWithRouteRef(
    id: string,
    lineId: string,
    stationIds: string[],
    routeId: string,
    pathId: string,
    direction: 'outbound' | 'inbound'
  ): Variant {
    return {
      ...createVariant(id, lineId, stationIds, direction),
      routeRefs: [
        {
          routeId,
          pathId,
          direction,
        },
      ],
    };
  }

  it('splits trains by direction from routeRefs', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Brno',
      paths: [
        createPath('p1', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    const outboundVariant = createVariantWithRouteRef('v1', 'l1', ['Praha', 'Brno'], 'r1', 'p1', 'outbound');
    const inboundVariant = createVariantWithRouteRef('v2', 'l1', ['Brno', 'Praha'], 'r1', 'p1', 'inbound');

    const timetables = [
      createTimetable('R101', 'v1', [
        { stationId: 'Praha', departure: '08:00' },
        { stationId: 'Brno', arrival: '10:00' },
      ]),
      createTimetable('R102', 'v2', [
        { stationId: 'Brno', departure: '09:00' },
        { stationId: 'Praha', arrival: '11:00' },
      ]),
    ];

    const result = buildRouteTimetableData(
      route,
      [outboundVariant, inboundVariant],
      timetables,
      stations,
      lines
    );

    expect(result.outboundEntries).toHaveLength(1);
    expect(result.inboundEntries).toHaveLength(1);
    expect(result.outboundEntries[0].trainNumber).toBe('R101');
    expect(result.outboundEntries[0].routeDirection).toBe('outbound');
    expect(result.inboundEntries[0].trainNumber).toBe('R102');
    expect(result.inboundEntries[0].routeDirection).toBe('inbound');
  });

  it('uses routeRef direction, not variant overall direction', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Brno',
      paths: [
        createPath('p1', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Variant has outbound overall direction, but uses route in inbound direction
    const variant: Variant = {
      ...createVariant('v1', 'l1', ['Brno', 'Praha'], 'outbound'),
      routeRefs: [
        {
          routeId: 'r1',
          pathId: 'p1',
          direction: 'inbound', // Different from variant.direction
        },
      ],
    };

    const timetable = createTimetable('R101', 'v1', [
      { stationId: 'Brno', departure: '08:00' },
      { stationId: 'Praha', arrival: '10:00' },
    ]);

    const result = buildRouteTimetableData(route, [variant], [timetable], stations, lines);

    // Should be in inbound based on routeRef.direction, not variant.direction
    expect(result.outboundEntries).toHaveLength(0);
    expect(result.inboundEntries).toHaveLength(1);
    expect(result.inboundEntries[0].routeDirection).toBe('inbound');
  });

  it('handles train with single stop on route correctly', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Brno',
      paths: [
        createPath('p1', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Variant only stops at Praha on this route but has routeRef with direction
    const variant: Variant = {
      ...createVariant('v1', 'l1', ['Ostrava', 'Praha'], 'inbound'),
      routeRefs: [
        {
          routeId: 'r1',
          pathId: 'p1',
          direction: 'inbound',
        },
      ],
    };

    const timetable = createTimetable('R101', 'v1', [
      { stationId: 'Ostrava', departure: '06:00' },
      { stationId: 'Praha', arrival: '10:00' },
    ]);

    const result = buildRouteTimetableData(route, [variant], [timetable], stations, lines);

    // Should categorize correctly by routeRef direction even with single stop
    expect(result.inboundEntries).toHaveLength(1);
    expect(result.outboundEntries).toHaveLength(0);
    expect(result.inboundEntries[0].routeDirection).toBe('inbound');
    expect(result.inboundEntries[0].times.has('Praha')).toBe(true);
    expect(result.inboundEntries[0].times.has('Brno')).toBe(false);
  });

  it('defaults to outbound when no matching routeRef', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Brno',
      paths: [
        createPath('p1', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Variant with routeRef pointing to different route
    const variant: Variant = {
      ...createVariant('v1', 'l1', ['Praha', 'Brno'], 'inbound'),
      routeRefs: [
        {
          routeId: 'different-route',
          pathId: 'p1',
          direction: 'inbound',
        },
      ],
    };

    const timetable = createTimetable('R101', 'v1', [
      { stationId: 'Praha', departure: '08:00' },
      { stationId: 'Brno', arrival: '10:00' },
    ]);

    const result = buildRouteTimetableData(route, [variant], [timetable], stations, lines);

    // Should default to outbound when no matching routeRef
    expect(result.outboundEntries).toHaveLength(1);
    expect(result.inboundEntries).toHaveLength(0);
    expect(result.outboundEntries[0].routeDirection).toBe('outbound');
  });

  it('handles all trains in same direction', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Brno',
      paths: [
        createPath('p1', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    const variant1 = createVariantWithRouteRef('v1', 'l1', ['Praha', 'Brno'], 'r1', 'p1', 'outbound');
    const variant2 = createVariantWithRouteRef('v2', 'l1', ['Praha', 'Brno'], 'r1', 'p1', 'outbound');

    const timetables = [
      createTimetable('R101', 'v1', [
        { stationId: 'Praha', departure: '08:00' },
        { stationId: 'Brno', arrival: '10:00' },
      ]),
      createTimetable('R102', 'v2', [
        { stationId: 'Praha', departure: '09:00' },
        { stationId: 'Brno', arrival: '11:00' },
      ]),
    ];

    const result = buildRouteTimetableData(
      route,
      [variant1, variant2],
      timetables,
      stations,
      lines
    );

    expect(result.outboundEntries).toHaveLength(2);
    expect(result.inboundEntries).toHaveLength(0);
  });
});

describe('calculatePathDistance', () => {
  it('returns 0 for empty path', () => {
    const path = createPath('p1', 'Empty', []);
    expect(calculatePathDistance(path)).toBe(0);
  });

  it('returns cumulative distance of last stop', () => {
    const path: RoutePath = {
      id: 'p1',
      name: 'Test',
      stops: [
        { stationId: 'A', sequence: 1, distanceFromPrevious: 0, distanceKm: 0, baseTimeFromPrevious: 0, defaultDwellTime: 1 },
        { stationId: 'B', sequence: 2, distanceFromPrevious: 50, distanceKm: 50, baseTimeFromPrevious: 30, defaultDwellTime: 1 },
        { stationId: 'C', sequence: 3, distanceFromPrevious: 75, distanceKm: 125, baseTimeFromPrevious: 45, defaultDwellTime: 1 },
      ],
    };
    expect(calculatePathDistance(path)).toBe(125);
  });
});

describe('calculatePathTime', () => {
  it('returns 0 for empty path', () => {
    const path = createPath('p1', 'Empty', []);
    expect(calculatePathTime(path)).toBe(0);
  });

  it('sums vrtTime for all stops', () => {
    const path: RoutePath = {
      id: 'p1',
      name: 'Test',
      stops: [
        { stationId: 'A', sequence: 1, distanceFromPrevious: 0, distanceKm: 0, vrtTime: 0, defaultDwellTime: 1 },
        { stationId: 'B', sequence: 2, distanceFromPrevious: 50, distanceKm: 50, vrtTime: 30, defaultDwellTime: 1 },
        { stationId: 'C', sequence: 3, distanceFromPrevious: 75, distanceKm: 125, vrtTime: 45, defaultDwellTime: 1 },
      ],
    };
    expect(calculatePathTime(path)).toBe(75); // 0 + 30 + 45
  });
});

describe('getRouteEndpoints', () => {
  const stationMap = new Map([
    ['Praha', createStation('Praha', 'Praha hl.n.')],
    ['Brno', createStation('Brno', 'Brno hl.n.')],
  ]);

  it('returns undefined for empty route', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Empty',
      paths: [],
      createdAt: '',
      updatedAt: '',
    };

    const endpoints = getRouteEndpoints(route, stationMap);
    expect(endpoints.from).toBeUndefined();
    expect(endpoints.to).toBeUndefined();
  });

  it('returns first and last stations of first path', () => {
    const route: RouteCorridor = {
      id: 'r1',
      name: 'Praha-Brno',
      paths: [
        createPath('p1', 'Direct', [
          { stationId: 'Praha', sequence: 1 },
          { stationId: 'Brno', sequence: 2 },
        ]),
      ],
      createdAt: '',
      updatedAt: '',
    };

    const endpoints = getRouteEndpoints(route, stationMap);
    expect(endpoints.from?.id).toBe('Praha');
    expect(endpoints.to?.id).toBe('Brno');
  });
});
