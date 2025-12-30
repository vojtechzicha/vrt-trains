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

  it('sums baseTimeFromPrevious for all stops', () => {
    const path: RoutePath = {
      id: 'p1',
      name: 'Test',
      stops: [
        { stationId: 'A', sequence: 1, distanceFromPrevious: 0, distanceKm: 0, baseTimeFromPrevious: 0, defaultDwellTime: 1 },
        { stationId: 'B', sequence: 2, distanceFromPrevious: 50, distanceKm: 50, baseTimeFromPrevious: 30, defaultDwellTime: 1 },
        { stationId: 'C', sequence: 3, distanceFromPrevious: 75, distanceKm: 125, baseTimeFromPrevious: 45, defaultDwellTime: 1 },
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
