import { describe, it, expect } from 'vitest';
import { buildCumulativeTimeLookup, buildSegmentTimeLookup } from './routeTimes';
import { segmentsToRouteRefs } from '@/components/admin/RouteSequenceBuilder';
import { RouteCorridor, VariantRouteRef } from '@/types';

/**
 * Test data structure:
 *
 * Route A (id: 'route-a'): Station1 → Station2 → Station3
 *   - Station1: sequence=1, vrtTime=0 (first station)
 *   - Station2: sequence=2, vrtTime=10 (10 min from Station1)
 *   - Station3: sequence=3, vrtTime=5 (5 min from Station2, total 15 from start)
 *
 * Route B (id: 'route-b'): Station3 → Station4 → Station5
 *   - Station3: sequence=1, vrtTime=0 (junction with Route A)
 *   - Station4: sequence=2, vrtTime=20 (20 min from Station3)
 *   - Station5: sequence=3, vrtTime=25 (25 min from Station4, total 45 from Station3)
 *
 * Forward traversal (outbound):
 *   routeRefs = [RouteA(outbound), RouteB(outbound)]
 *   Expected times: Station1=0, Station2=10, Station3=15, Station4=35, Station5=60
 *
 * Reverse traversal (inbound) with CORRECT routeRef order:
 *   routeRefs = [RouteB(inbound), RouteA(inbound)]
 *   Expected: Station5=0, Station4=20, Station3=45, Station2=55, Station1=60
 *
 * Reverse traversal with WRONG routeRef order (the bug):
 *   routeRefs = [RouteA(inbound), RouteB(inbound)]
 *   This produces incorrect times!
 */

function createTestRoutes(): RouteCorridor[] {
  return [
    {
      id: 'route-a',
      name: 'Route A',
      paths: [
        {
          id: 'path-a',
          name: 'Main Path A',
          stops: [
            { stationId: 'station-1', sequence: 1, distanceFromPrevious: 0, distanceKm: 0, vrtTime: 0, defaultDwellTime: 2 },
            { stationId: 'station-2', sequence: 2, distanceFromPrevious: 50, distanceKm: 50, vrtTime: 10, defaultDwellTime: 2 },
            { stationId: 'station-3', sequence: 3, distanceFromPrevious: 30, distanceKm: 80, vrtTime: 5, defaultDwellTime: 2 },
          ],
        },
      ],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    {
      id: 'route-b',
      name: 'Route B',
      paths: [
        {
          id: 'path-b',
          name: 'Main Path B',
          stops: [
            { stationId: 'station-3', sequence: 1, distanceFromPrevious: 0, distanceKm: 0, vrtTime: 0, defaultDwellTime: 2 },
            { stationId: 'station-4', sequence: 2, distanceFromPrevious: 100, distanceKm: 100, vrtTime: 20, defaultDwellTime: 2 },
            { stationId: 'station-5', sequence: 3, distanceFromPrevious: 120, distanceKm: 220, vrtTime: 25, defaultDwellTime: 2 },
          ],
        },
      ],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ];
}

describe('buildCumulativeTimeLookup', () => {
  describe('forward traversal (direction=outbound)', () => {
    it('calculates cumulative times for single routeRef', () => {
      const routes = createTestRoutes();
      const routeRefs: VariantRouteRef[] = [
        { routeId: 'route-a', pathId: 'path-a', direction: 'outbound', speedCategory: 'vrt' },
      ];

      const lookup = buildCumulativeTimeLookup(routeRefs, routes);

      expect(lookup.get('station-1')).toBe(0);
      expect(lookup.get('station-2')).toBe(10);
      expect(lookup.get('station-3')).toBe(15);
    });

    it('accumulates times correctly across multiple routeRefs', () => {
      const routes = createTestRoutes();
      const routeRefs: VariantRouteRef[] = [
        { routeId: 'route-a', pathId: 'path-a', direction: 'outbound', speedCategory: 'vrt' },
        { routeId: 'route-b', pathId: 'path-b', direction: 'outbound', speedCategory: 'vrt' },
      ];

      const lookup = buildCumulativeTimeLookup(routeRefs, routes);

      // Route A: Station1=0, Station2=10, Station3=15
      expect(lookup.get('station-1')).toBe(0);
      expect(lookup.get('station-2')).toBe(10);
      expect(lookup.get('station-3')).toBe(15);
      // Route B continues from Station3: Station4=15+20=35, Station5=35+25=60
      expect(lookup.get('station-4')).toBe(35);
      expect(lookup.get('station-5')).toBe(60);
    });
  });

  describe('reversed traversal (direction=inbound)', () => {
    it('calculates cumulative times for single reversed routeRef', () => {
      const routes = createTestRoutes();
      const routeRefs: VariantRouteRef[] = [
        { routeId: 'route-a', pathId: 'path-a', direction: 'inbound', speedCategory: 'vrt' },
      ];

      const lookup = buildCumulativeTimeLookup(routeRefs, routes);

      // Reversed: Station3 → Station2 → Station1
      // Station3 is first (time=0)
      // Station2: time from Station3→Station2 is stored on Station3 (vrtTime=5), so cumulative=5
      // Station1: time from Station2→Station1 is stored on Station2 (vrtTime=10), so cumulative=15
      expect(lookup.get('station-3')).toBe(0);
      expect(lookup.get('station-2')).toBe(5);
      expect(lookup.get('station-1')).toBe(15);
    });

    it('accumulates times correctly with reversed multi-segment (correct routeRef order)', () => {
      const routes = createTestRoutes();
      // For reverse traversal Station5→Station1, routeRefs must be in order [RouteB, RouteA]
      const routeRefs: VariantRouteRef[] = [
        { routeId: 'route-b', pathId: 'path-b', direction: 'inbound', speedCategory: 'vrt' },
        { routeId: 'route-a', pathId: 'path-a', direction: 'inbound', speedCategory: 'vrt' },
      ];

      const lookup = buildCumulativeTimeLookup(routeRefs, routes);

      // Route B reversed: Station5→Station4→Station3
      // - Station5 = 0 (first)
      // - Station4 = 25 (time from Station5, stored on Station5 as vrtTime=25)
      // - Station3 = 45 (time from Station4, stored on Station4 as vrtTime=20)
      expect(lookup.get('station-5')).toBe(0);
      expect(lookup.get('station-4')).toBe(25);
      expect(lookup.get('station-3')).toBe(45);
      // Route A continues from Station3: Station2=45+5=50, Station1=50+10=60
      expect(lookup.get('station-2')).toBe(50);
      expect(lookup.get('station-1')).toBe(60);
    });
  });

  describe('routeRefs order affects cumulative times (bug scenario)', () => {
    it('produces different results when routeRefs are in wrong order', () => {
      const routes = createTestRoutes();

      // CORRECT order for reverse traversal
      const correctRefs: VariantRouteRef[] = [
        { routeId: 'route-b', pathId: 'path-b', direction: 'inbound', speedCategory: 'vrt' },
        { routeId: 'route-a', pathId: 'path-a', direction: 'inbound', speedCategory: 'vrt' },
      ];

      // WRONG order (the bug - routeRefs not reversed when creating reverse variant)
      const wrongRefs: VariantRouteRef[] = [
        { routeId: 'route-a', pathId: 'path-a', direction: 'inbound', speedCategory: 'vrt' },
        { routeId: 'route-b', pathId: 'path-b', direction: 'inbound', speedCategory: 'vrt' },
      ];

      const correctLookup = buildCumulativeTimeLookup(correctRefs, routes);
      const wrongLookup = buildCumulativeTimeLookup(wrongRefs, routes);

      // Correct order should have Station5=0 (first station in traversal)
      expect(correctLookup.get('station-5')).toBe(0);

      // Wrong order has Station3=0 first (from Route A reversed), then Station5 gets a time
      expect(wrongLookup.get('station-3')).toBe(0);
      // Station5 gets calculated from Route B's position, not from start
      expect(wrongLookup.get('station-5')).not.toBe(0);

      // The results are fundamentally different
      expect(correctLookup.get('station-1')).not.toBe(wrongLookup.get('station-1'));
    });

    it('correct order produces monotonically increasing times along the route', () => {
      const routes = createTestRoutes();
      const correctRefs: VariantRouteRef[] = [
        { routeId: 'route-b', pathId: 'path-b', direction: 'inbound', speedCategory: 'vrt' },
        { routeId: 'route-a', pathId: 'path-a', direction: 'inbound', speedCategory: 'vrt' },
      ];

      const lookup = buildCumulativeTimeLookup(correctRefs, routes);

      // Times should increase along the traversal path
      const times = [
        lookup.get('station-5')!, // First
        lookup.get('station-4')!,
        lookup.get('station-3')!,
        lookup.get('station-2')!,
        lookup.get('station-1')!, // Last
      ];

      // Each time should be greater than or equal to the previous
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      }
    });
  });

  describe('subset handling (startStationId/endStationId)', () => {
    it('applies startStationId subset correctly in forward direction', () => {
      const routes = createTestRoutes();
      const routeRefs: VariantRouteRef[] = [
        {
          routeId: 'route-a',
          pathId: 'path-a',
          direction: 'outbound',
          speedCategory: 'vrt',
          startStationId: 'station-2', // Start from Station2
        },
      ];

      const lookup = buildCumulativeTimeLookup(routeRefs, routes);

      // Should not include Station1
      expect(lookup.has('station-1')).toBe(false);
      // Station2 is now first (time=0)
      expect(lookup.get('station-2')).toBe(0);
      // Station3 is 5 min from Station2
      expect(lookup.get('station-3')).toBe(5);
    });

    it('applies endStationId subset correctly in forward direction', () => {
      const routes = createTestRoutes();
      const routeRefs: VariantRouteRef[] = [
        {
          routeId: 'route-a',
          pathId: 'path-a',
          direction: 'outbound',
          speedCategory: 'vrt',
          endStationId: 'station-2', // End at Station2
        },
      ];

      const lookup = buildCumulativeTimeLookup(routeRefs, routes);

      // Should include Station1 and Station2
      expect(lookup.get('station-1')).toBe(0);
      expect(lookup.get('station-2')).toBe(10);
      // Should not include Station3
      expect(lookup.has('station-3')).toBe(false);
    });

    it('applies subset BEFORE reversing (startStationId in forward path order)', () => {
      const routes = createTestRoutes();
      const routeRefs: VariantRouteRef[] = [
        {
          routeId: 'route-a',
          pathId: 'path-a',
          direction: 'inbound',
          speedCategory: 'vrt',
          startStationId: 'station-2', // Subset: Station2→Station3 in forward order
        },
      ];

      const lookup = buildCumulativeTimeLookup(routeRefs, routes);

      // Subset Station2→Station3, then reversed to Station3→Station2
      expect(lookup.has('station-1')).toBe(false);
      expect(lookup.get('station-3')).toBe(0); // First after subset+reverse
      expect(lookup.get('station-2')).toBe(5); // Time from Station3→Station2
    });

    it('applies both startStationId and endStationId correctly', () => {
      const routes: RouteCorridor[] = [
        {
          id: 'route-long',
          name: 'Long Route',
          paths: [
            {
              id: 'path-long',
              name: 'Main Path',
              stops: [
                { stationId: 'A', sequence: 1, distanceFromPrevious: 0, distanceKm: 0, vrtTime: 0, defaultDwellTime: 2 },
                { stationId: 'B', sequence: 2, distanceFromPrevious: 50, distanceKm: 50, vrtTime: 10, defaultDwellTime: 2 },
                { stationId: 'C', sequence: 3, distanceFromPrevious: 50, distanceKm: 100, vrtTime: 10, defaultDwellTime: 2 },
                { stationId: 'D', sequence: 4, distanceFromPrevious: 50, distanceKm: 150, vrtTime: 10, defaultDwellTime: 2 },
                { stationId: 'E', sequence: 5, distanceFromPrevious: 50, distanceKm: 200, vrtTime: 10, defaultDwellTime: 2 },
              ],
            },
          ],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ];

      const routeRefs: VariantRouteRef[] = [
        {
          routeId: 'route-long',
          pathId: 'path-long',
          direction: 'outbound',
          speedCategory: 'vrt',
          startStationId: 'B',
          endStationId: 'D',
        },
      ];

      const lookup = buildCumulativeTimeLookup(routeRefs, routes);

      // Should only include B, C, D
      expect(lookup.has('A')).toBe(false);
      expect(lookup.has('E')).toBe(false);
      expect(lookup.get('B')).toBe(0);
      expect(lookup.get('C')).toBe(10);
      expect(lookup.get('D')).toBe(20);
    });
  });
});

describe('buildSegmentTimeLookup', () => {
  it('returns segment times (time from previous station)', () => {
    const routes = createTestRoutes();
    const routeRefs: VariantRouteRef[] = [
      { routeId: 'route-a', pathId: 'path-a', direction: 'outbound', speedCategory: 'vrt' },
    ];

    const lookup = buildSegmentTimeLookup(routeRefs, routes);

    expect(lookup.get('station-1')).toBe(0); // First station
    expect(lookup.get('station-2')).toBe(10); // 10 min from Station1
    expect(lookup.get('station-3')).toBe(5); // 5 min from Station2
  });

  it('handles reversed direction correctly', () => {
    const routes = createTestRoutes();
    const routeRefs: VariantRouteRef[] = [
      { routeId: 'route-a', pathId: 'path-a', direction: 'inbound', speedCategory: 'vrt' },
    ];

    const lookup = buildSegmentTimeLookup(routeRefs, routes);

    // Reversed: Station3 → Station2 → Station1
    expect(lookup.get('station-3')).toBe(0); // First station in reversed order
    expect(lookup.get('station-2')).toBe(5); // Time stored on Station3 (previous in reverse)
    expect(lookup.get('station-1')).toBe(10); // Time stored on Station2 (previous in reverse)
  });
});

describe('segmentsToRouteRefs', () => {
  const baseSegment = {
    routeId: 'route-a',
    pathId: 'path-a',
    speedCategory: 'vrt' as const,
  };

  describe('with baseDirection=outbound', () => {
    it('non-reversed segment produces direction=outbound', () => {
      const segments = [{ ...baseSegment, reversed: false }];
      const refs = segmentsToRouteRefs(segments, 'outbound');

      expect(refs[0].direction).toBe('outbound');
    });

    it('reversed segment produces direction=inbound', () => {
      const segments = [{ ...baseSegment, reversed: true }];
      const refs = segmentsToRouteRefs(segments, 'outbound');

      expect(refs[0].direction).toBe('inbound');
    });
  });

  describe('with baseDirection=inbound', () => {
    it('non-reversed segment produces direction=inbound', () => {
      const segments = [{ ...baseSegment, reversed: false }];
      const refs = segmentsToRouteRefs(segments, 'inbound');

      expect(refs[0].direction).toBe('inbound');
    });

    it('reversed segment produces direction=outbound', () => {
      const segments = [{ ...baseSegment, reversed: true }];
      const refs = segmentsToRouteRefs(segments, 'inbound');

      expect(refs[0].direction).toBe('outbound');
    });
  });

  describe('symmetry with segment reconstruction', () => {
    /**
     * Segment reconstruction uses: reversed = (ref.direction !== variant.direction)
     * So segmentsToRouteRefs must be symmetric:
     * - If not reversed: direction = baseDirection
     * - If reversed: direction = opposite of baseDirection
     */

    it('round-trip preserves reversed=false for outbound variant', () => {
      const segments = [{ ...baseSegment, reversed: false }];
      const refs = segmentsToRouteRefs(segments, 'outbound');
      // Reconstruction: reversed = (ref.direction !== 'outbound') = ('outbound' !== 'outbound') = false
      const reconstructedReversed = refs[0].direction !== 'outbound';
      expect(reconstructedReversed).toBe(false);
    });

    it('round-trip preserves reversed=true for outbound variant', () => {
      const segments = [{ ...baseSegment, reversed: true }];
      const refs = segmentsToRouteRefs(segments, 'outbound');
      // Reconstruction: reversed = (ref.direction !== 'outbound') = ('inbound' !== 'outbound') = true
      const reconstructedReversed = refs[0].direction !== 'outbound';
      expect(reconstructedReversed).toBe(true);
    });

    it('round-trip preserves reversed=false for inbound variant', () => {
      const segments = [{ ...baseSegment, reversed: false }];
      const refs = segmentsToRouteRefs(segments, 'inbound');
      // Reconstruction: reversed = (ref.direction !== 'inbound') = ('inbound' !== 'inbound') = false
      const reconstructedReversed = refs[0].direction !== 'inbound';
      expect(reconstructedReversed).toBe(false);
    });

    it('round-trip preserves reversed=true for inbound variant', () => {
      const segments = [{ ...baseSegment, reversed: true }];
      const refs = segmentsToRouteRefs(segments, 'inbound');
      // Reconstruction: reversed = (ref.direction !== 'inbound') = ('outbound' !== 'inbound') = true
      const reconstructedReversed = refs[0].direction !== 'inbound';
      expect(reconstructedReversed).toBe(true);
    });
  });
});

describe('reverse variant routeRefs', () => {
  /**
   * When creating a reverse variant:
   * 1. Reverse the routeRefs array order
   * 2. Flip each individual direction (outbound↔inbound)
   */

  function createReverseRefs(routeRefs: VariantRouteRef[]): VariantRouteRef[] {
    return [...routeRefs].reverse().map(ref => ({
      ...ref,
      direction: ref.direction === 'outbound' ? 'inbound' : 'outbound',
    }));
  }

  it('reverses array order', () => {
    const forward: VariantRouteRef[] = [
      { routeId: 'a', pathId: 'a', direction: 'outbound', speedCategory: 'vrt' },
      { routeId: 'b', pathId: 'b', direction: 'outbound', speedCategory: 'vrt' },
    ];

    const reverse = createReverseRefs(forward);

    expect(reverse[0].routeId).toBe('b');
    expect(reverse[1].routeId).toBe('a');
  });

  it('flips each individual direction', () => {
    const forward: VariantRouteRef[] = [
      { routeId: 'a', pathId: 'a', direction: 'outbound', speedCategory: 'vrt' },
      { routeId: 'b', pathId: 'b', direction: 'inbound', speedCategory: 'vrt' },
      { routeId: 'c', pathId: 'c', direction: 'outbound', speedCategory: 'vrt' },
    ];

    const reverse = createReverseRefs(forward);

    // Array is reversed: c, b, a
    // Each direction is flipped
    expect(reverse[0].routeId).toBe('c');
    expect(reverse[0].direction).toBe('inbound'); // was 'outbound'

    expect(reverse[1].routeId).toBe('b');
    expect(reverse[1].direction).toBe('outbound'); // was 'inbound'

    expect(reverse[2].routeId).toBe('a');
    expect(reverse[2].direction).toBe('inbound'); // was 'outbound'
  });

  it('preserves other properties', () => {
    const forward: VariantRouteRef[] = [
      {
        routeId: 'a',
        pathId: 'p1',
        direction: 'outbound',
        speedCategory: 'fast',
        startStationId: 'start',
        endStationId: 'end',
      },
    ];

    const reverse = createReverseRefs(forward);

    expect(reverse[0].routeId).toBe('a');
    expect(reverse[0].pathId).toBe('p1');
    expect(reverse[0].speedCategory).toBe('fast');
    expect(reverse[0].startStationId).toBe('start');
    expect(reverse[0].endStationId).toBe('end');
  });
});
