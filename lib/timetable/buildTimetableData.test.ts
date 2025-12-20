import { describe, it, expect } from 'vitest';
import {
  buildStationOrder,
  buildTimetableEntries,
  buildOrderingConstraints,
  canInsertAt,
  getFirstDepartureTime,
  buildTimetableData,
  findBestStation,
  findCommonStationWithSorted,
  sortEntriesHolistically,
  TimetableEntry,
  parseTimeToMinutes,
  isOvernightTrain,
  applyOvernightPenalty,
} from './buildTimetableData';
import { Variant, Timetable } from '@/types';

// Helper to create a minimal variant
function createVariant(
  id: string,
  stations: { stationId: string; sequence: number }[],
  direction: 'outbound' | 'inbound' = 'outbound',
  code: string = 'V1'
): Variant {
  return {
    id,
    lineId: 'line1',
    code,
    name: 'Test Variant',
    direction,
    stations: stations.map((s) => ({
      ...s,
      arrivalOffset: null,
      departureOffset: 0,
      platform: '1',
      stopType: 'regular' as const,
    })),
  };
}

// Helper to create a minimal timetable
function createTimetable(
  id: string,
  variantId: string,
  trainNumber: string,
  departures: { stationId: string; departure: string | null; arrival: string | null }[]
): Timetable {
  return {
    id,
    variantId,
    trainNumber,
    operatingDays: ['monday'],
    departures: departures.map((d) => ({
      ...d,
      platform: '1',
    })),
  };
}

describe('buildOrderingConstraints', () => {
  it('builds constraints from single variant', () => {
    const variant = createVariant('v1', [
      { stationId: 'A', sequence: 1 },
      { stationId: 'B', sequence: 2 },
      { stationId: 'C', sequence: 3 },
    ]);

    const constraints = buildOrderingConstraints([variant]);

    expect(constraints.get('A')?.has('B')).toBe(true);
    expect(constraints.get('A')?.has('C')).toBe(true);
    expect(constraints.get('B')?.has('C')).toBe(true);
    expect(constraints.get('C')?.size || 0).toBe(0);
  });

  it('merges constraints from multiple variants', () => {
    const v1 = createVariant('v1', [
      { stationId: 'A', sequence: 1 },
      { stationId: 'B', sequence: 2 },
    ]);
    const v2 = createVariant('v2', [
      { stationId: 'B', sequence: 1 },
      { stationId: 'C', sequence: 2 },
    ]);

    const constraints = buildOrderingConstraints([v1, v2]);

    expect(constraints.get('A')?.has('B')).toBe(true);
    expect(constraints.get('B')?.has('C')).toBe(true);
  });
});

describe('canInsertAt', () => {
  it('allows insertion when no constraints violated', () => {
    const ordered = ['A', 'C'];
    const constraints = new Map<string, Set<string>>();
    constraints.set('A', new Set(['B', 'C']));
    constraints.set('B', new Set(['C']));

    expect(canInsertAt('B', 1, ordered, constraints)).toBe(true);
  });

  it('rejects insertion that violates constraints', () => {
    const ordered = ['B', 'C'];
    const constraints = new Map<string, Set<string>>();
    constraints.set('A', new Set(['B'])); // A must come before B

    // Trying to insert A after B should fail
    expect(canInsertAt('A', 2, ordered, constraints)).toBe(false);
  });
});

describe('buildStationOrder', () => {
  it('returns empty array for empty variants', () => {
    expect(buildStationOrder([])).toEqual([]);
  });

  it('returns stations in sequence order for single variant', () => {
    const variant = createVariant('v1', [
      { stationId: 'C', sequence: 3 },
      { stationId: 'A', sequence: 1 },
      { stationId: 'B', sequence: 2 },
    ]);

    const order = buildStationOrder([variant]);

    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('merges stations from multiple variants', () => {
    const v1 = createVariant('v1', [
      { stationId: 'A', sequence: 1 },
      { stationId: 'B', sequence: 2 },
      { stationId: 'C', sequence: 3 },
    ]);
    const v2 = createVariant('v2', [
      { stationId: 'A', sequence: 1 },
      { stationId: 'D', sequence: 2 }, // Different middle station
      { stationId: 'C', sequence: 3 },
    ]);

    const order = buildStationOrder([v1, v2]);

    // Should have all stations, with D somewhere between A and C
    expect(order).toContain('A');
    expect(order).toContain('B');
    expect(order).toContain('C');
    expect(order).toContain('D');
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));
  });
});

// Helper to create a minimal TimetableEntry for testing
function createEntry(
  trainNumber: string,
  times: Record<string, { departure: string | null; arrival: string | null }>
): TimetableEntry {
  const timesMap = new Map(
    Object.entries(times).map(([k, v]) => [k, v])
  );
  return {
    trainNumber,
    variantCode: 'V1',
    times: timesMap,
    sortTime: '99:99',
    firstStationIdx: -1,
    lastStationIdx: -1,
  };
}

describe('findBestStation', () => {
  it('finds station with most trains', () => {
    const entries = [
      createEntry('T1', { A: { departure: '06:00', arrival: null }, B: { departure: '07:00', arrival: null } }),
      createEntry('T2', { B: { departure: '08:00', arrival: null }, C: { departure: '09:00', arrival: null } }),
      createEntry('T3', { A: { departure: '10:00', arrival: null }, B: { departure: '11:00', arrival: null } }),
    ];

    const result = findBestStation(entries, ['A', 'B', 'C']);

    expect(result.stationId).toBe('B'); // B has 3 trains, A has 2, C has 1
    expect(result.count).toBe(3);
  });

  it('returns first station with highest count when tied', () => {
    const entries = [
      createEntry('T1', { A: { departure: '06:00', arrival: null }, B: { departure: '07:00', arrival: null } }),
      createEntry('T2', { A: { departure: '08:00', arrival: null }, B: { departure: '09:00', arrival: null } }),
    ];

    const result = findBestStation(entries, ['A', 'B']);

    expect(result.stationId).toBe('A'); // A appears first, both have count 2
    expect(result.count).toBe(2);
  });
});

describe('findCommonStationWithSorted', () => {
  it('finds common station between entry and sorted entries', () => {
    const sorted = [
      createEntry('T1', { A: { departure: '06:00', arrival: null }, B: { departure: '07:00', arrival: null } }),
    ];
    const entry = createEntry('T2', { B: { departure: '08:00', arrival: null }, C: { departure: '09:00', arrival: null } });

    const result = findCommonStationWithSorted(entry, sorted, ['A', 'B', 'C']);

    expect(result.stationId).toBe('B');
    expect(result.sortTime).toBe('08:00');
  });

  it('returns null when no common station', () => {
    const sorted = [
      createEntry('T1', { A: { departure: '06:00', arrival: null } }),
    ];
    const entry = createEntry('T2', { C: { departure: '09:00', arrival: null } });

    const result = findCommonStationWithSorted(entry, sorted, ['A', 'B', 'C']);

    expect(result.stationId).toBe(null);
  });
});

describe('sortEntriesHolistically', () => {
  it('sorts trains by common station time', () => {
    const entries = [
      createEntry('T2', { A: { departure: '08:00', arrival: null } }),
      createEntry('T1', { A: { departure: '06:00', arrival: null } }),
      createEntry('T3', { A: { departure: '07:00', arrival: null } }),
    ];
    const timetables = [
      createTimetable('t2', 'v1', 'T2', [{ stationId: 'A', departure: '08:00', arrival: null }]),
      createTimetable('t1', 'v1', 'T1', [{ stationId: 'A', departure: '06:00', arrival: null }]),
      createTimetable('t3', 'v1', 'T3', [{ stationId: 'A', departure: '07:00', arrival: null }]),
    ];

    const sorted = sortEntriesHolistically(entries, timetables, ['A']);

    expect(sorted.map((e) => e.trainNumber)).toEqual(['T1', 'T3', 'T2']);
  });

  it('handles overlapping groups with different starting stations', () => {
    // Simulates: trains from different origins meeting at a common station
    const entries = [
      createEntry('T1', {
        Praha: { departure: '06:00', arrival: null },
        Olomouc: { departure: '08:00', arrival: '07:55' }
      }),
      createEntry('T2', {
        Olomouc: { departure: '06:30', arrival: null },
        Ostrava: { departure: '07:30', arrival: null }
      }),
      createEntry('T3', {
        Cheb: { departure: '05:00', arrival: null },
        Praha: { departure: '07:00', arrival: '06:55' },
        Olomouc: { departure: '09:00', arrival: '08:55' }
      }),
    ];
    const timetables = [
      createTimetable('t1', 'v1', 'T1', [
        { stationId: 'Praha', departure: '06:00', arrival: null },
        { stationId: 'Olomouc', departure: '08:00', arrival: '07:55' },
      ]),
      createTimetable('t2', 'v2', 'T2', [
        { stationId: 'Olomouc', departure: '06:30', arrival: null },
        { stationId: 'Ostrava', departure: '07:30', arrival: null },
      ]),
      createTimetable('t3', 'v3', 'T3', [
        { stationId: 'Cheb', departure: '05:00', arrival: null },
        { stationId: 'Praha', departure: '07:00', arrival: '06:55' },
        { stationId: 'Olomouc', departure: '09:00', arrival: '08:55' },
      ]),
    ];

    const sorted = sortEntriesHolistically(entries, timetables, ['Cheb', 'Praha', 'Olomouc', 'Ostrava']);

    // All 3 pass through Olomouc, so sort by Olomouc time:
    // T2: 06:30, T1: 08:00, T3: 09:00
    expect(sorted.map((e) => e.trainNumber)).toEqual(['T2', 'T1', 'T3']);
  });

  it('handles train with no common station using first departure fallback', () => {
    const entries = [
      createEntry('T1', { A: { departure: '06:00', arrival: null }, B: { departure: '07:00', arrival: null } }),
      createEntry('T2', { A: { departure: '08:00', arrival: null }, B: { departure: '09:00', arrival: null } }),
      createEntry('T3', { C: { departure: '07:30', arrival: null }, D: { departure: '08:30', arrival: null } }), // No overlap
    ];
    const timetables = [
      createTimetable('t1', 'v1', 'T1', [
        { stationId: 'A', departure: '06:00', arrival: null },
        { stationId: 'B', departure: '07:00', arrival: null },
      ]),
      createTimetable('t2', 'v1', 'T2', [
        { stationId: 'A', departure: '08:00', arrival: null },
        { stationId: 'B', departure: '09:00', arrival: null },
      ]),
      createTimetable('t3', 'v2', 'T3', [
        { stationId: 'C', departure: '07:30', arrival: null },
        { stationId: 'D', departure: '08:30', arrival: null },
      ]),
    ];

    const sorted = sortEntriesHolistically(entries, timetables, ['A', 'B', 'C', 'D']);

    // T1 and T2 share A/B, T3 has no overlap
    // T1: 06:00 at A, T2: 08:00 at A, T3: 07:30 first departure (fallback)
    // Order: T1 (06:00), T3 (07:30), T2 (08:00)
    expect(sorted.map((e) => e.trainNumber)).toEqual(['T1', 'T3', 'T2']);
  });
});

describe('getFirstDepartureTime', () => {
  it('returns departure time of first stop', () => {
    const timetable = createTimetable('t1', 'v1', 'Train1', [
      { stationId: 'A', departure: '06:00', arrival: null },
      { stationId: 'B', departure: '07:00', arrival: '06:55' },
    ]);

    expect(getFirstDepartureTime(timetable)).toBe('06:00');
  });

  it('falls back to arrival if no departure', () => {
    const timetable = createTimetable('t1', 'v1', 'Train1', [
      { stationId: 'A', departure: null, arrival: '06:00' },
    ]);

    expect(getFirstDepartureTime(timetable)).toBe('06:00');
  });

  it('returns 99:99 for empty departures', () => {
    const timetable = createTimetable('t1', 'v1', 'Train1', []);

    expect(getFirstDepartureTime(timetable)).toBe('99:99');
  });
});

describe('buildTimetableEntries', () => {
  it('sorts trains by first departure time', () => {
    const variant = createVariant('v1', [
      { stationId: 'A', sequence: 1 },
      { stationId: 'B', sequence: 2 },
    ]);

    const timetables = [
      createTimetable('t1', 'v1', 'Train2', [
        { stationId: 'A', departure: '08:00', arrival: null },
        { stationId: 'B', departure: null, arrival: '09:00' },
      ]),
      createTimetable('t2', 'v1', 'Train1', [
        { stationId: 'A', departure: '06:00', arrival: null },
        { stationId: 'B', departure: null, arrival: '07:00' },
      ]),
      createTimetable('t3', 'v1', 'Train3', [
        { stationId: 'A', departure: '07:00', arrival: null },
        { stationId: 'B', departure: null, arrival: '08:00' },
      ]),
    ];

    const entries = buildTimetableEntries(timetables, [variant], ['A', 'B']);

    expect(entries.map((e) => e.trainNumber)).toEqual(['Train1', 'Train3', 'Train2']);
  });

  it('sorts trains from different variants by their first departure', () => {
    // Simulate Ex2 scenario: different variants with different starting stations
    const v1 = createVariant(
      'v1',
      [
        { stationId: 'Praha', sequence: 1 },
        { stationId: 'Plzen', sequence: 2 },
      ],
      'inbound',
      'Zapadni'
    );

    const v2 = createVariant(
      'v2',
      [
        { stationId: 'Brno', sequence: 1 },
        { stationId: 'Plzen', sequence: 2 },
      ],
      'inbound',
      'Transverzala'
    );

    const timetables = [
      createTimetable('t1', 'v1', 'Ex230', [
        { stationId: 'Praha', departure: '05:00', arrival: null },
        { stationId: 'Plzen', departure: null, arrival: '06:00' },
      ]),
      createTimetable('t2', 'v2', 'Ex200', [
        { stationId: 'Brno', departure: '10:00', arrival: null },
        { stationId: 'Plzen', departure: null, arrival: '12:00' },
      ]),
      createTimetable('t3', 'v1', 'Ex232', [
        { stationId: 'Praha', departure: '06:00', arrival: null },
        { stationId: 'Plzen', departure: null, arrival: '07:00' },
      ]),
    ];

    const stationOrder = buildStationOrder([v1, v2]);
    const entries = buildTimetableEntries(timetables, [v1, v2], stationOrder);

    // Should be sorted by first departure: Ex230 (05:00), Ex232 (06:00), Ex200 (10:00)
    expect(entries.map((e) => e.trainNumber)).toEqual(['Ex230', 'Ex232', 'Ex200']);
  });
});

describe('buildTimetableData', () => {
  it('returns complete timetable data with correct ordering', () => {
    const variant = createVariant('v1', [
      { stationId: 'A', sequence: 1 },
      { stationId: 'B', sequence: 2 },
    ]);

    const timetables = [
      createTimetable('t1', 'v1', 'Train2', [
        { stationId: 'A', departure: '08:00', arrival: null },
        { stationId: 'B', departure: null, arrival: '09:00' },
      ]),
      createTimetable('t2', 'v1', 'Train1', [
        { stationId: 'A', departure: '06:00', arrival: null },
        { stationId: 'B', departure: null, arrival: '07:00' },
      ]),
    ];

    const result = buildTimetableData([variant], timetables);

    expect(result.stationOrder).toEqual(['A', 'B']);
    expect(result.entries.map((e) => e.trainNumber)).toEqual(['Train1', 'Train2']);
  });

  it('handles empty inputs', () => {
    const result = buildTimetableData([], []);

    expect(result.stationOrder).toEqual([]);
    expect(result.entries).toEqual([]);
  });

  it('sorts by common reference station when trains have different starting points (Ex11 scenario)', () => {
    // Ex11 scenario: trains from different starting points all pass through Praha
    // - Ex1141 starts from Praha at 04:59
    // - Ex1131 starts from Pardubice at 05:45, reaches Praha at 06:29
    // - Ex1143 starts from Praha at 05:59
    // Expected order at Praha: Ex1141 (04:59), Ex1143 (05:59), Ex1131 (06:29)

    const v1 = createVariant(
      'v1',
      [
        { stationId: 'Pardubice', sequence: 1 },
        { stationId: 'Praha', sequence: 2 },
        { stationId: 'Kladno', sequence: 3 },
      ],
      'outbound',
      'Ex11'
    );

    const v2 = createVariant(
      'v2',
      [
        { stationId: 'Praha', sequence: 1 },
        { stationId: 'Letiste', sequence: 2 },
      ],
      'outbound',
      'Ex11-AE'
    );

    const timetables = [
      createTimetable('t1', 'v2', 'Ex1141', [
        { stationId: 'Praha', departure: '04:59', arrival: null },
        { stationId: 'Letiste', departure: null, arrival: '05:30' },
      ]),
      createTimetable('t2', 'v1', 'Ex1131', [
        { stationId: 'Pardubice', departure: '05:45', arrival: null },
        { stationId: 'Praha', departure: '06:30', arrival: '06:29' },
        { stationId: 'Kladno', departure: null, arrival: '07:00' },
      ]),
      createTimetable('t3', 'v2', 'Ex1143', [
        { stationId: 'Praha', departure: '05:59', arrival: null },
        { stationId: 'Letiste', departure: null, arrival: '06:30' },
      ]),
    ];

    const result = buildTimetableData([v1, v2], timetables);

    // All trains pass through Praha, so sort by Praha departure time:
    // Ex1141 (04:59 at Praha), Ex1143 (05:59 at Praha), Ex1131 (06:30 at Praha)
    expect(result.entries.map((e) => e.trainNumber)).toEqual(['Ex1141', 'Ex1143', 'Ex1131']);
  });

  it('sorts by best reference station when some trains skip it (Ex2 Olomouc scenario)', () => {
    // Ex2 scenario: most trains pass through Olomouc, but some don't
    // - Ex241 starts from Praha at 06:13, reaches Olomouc at 08:20
    // - Ex251 starts FROM Olomouc at 06:20
    // - Ex263 starts from Cheb at 06:45, reaches Olomouc at 11:20
    // - Ex231 starts from Cheb at 18:45, does NOT pass through Olomouc at all
    // Expected order: Ex251 (06:20), Ex241 (08:20), Ex263 (11:20), Ex231 (18:45 - by first dep)

    const v1 = createVariant(
      'v1',
      [
        { stationId: 'Praha', sequence: 1 },
        { stationId: 'Olomouc', sequence: 2 },
        { stationId: 'Ostrava', sequence: 3 },
      ],
      'outbound',
      'Ex2'
    );

    const v2 = createVariant(
      'v2',
      [
        { stationId: 'Olomouc', sequence: 1 },
        { stationId: 'Ostrava', sequence: 2 },
      ],
      'outbound',
      'Ex2'
    );

    const v3 = createVariant(
      'v3',
      [
        { stationId: 'Cheb', sequence: 1 },
        { stationId: 'Praha', sequence: 2 },
        { stationId: 'Olomouc', sequence: 3 },
        { stationId: 'Ostrava', sequence: 4 },
      ],
      'outbound',
      'Ex2'
    );

    const v4 = createVariant(
      'v4',
      [
        { stationId: 'Cheb', sequence: 1 },
        { stationId: 'Praha', sequence: 2 },
        { stationId: 'Brno', sequence: 3 }, // Different route, skips Olomouc
      ],
      'outbound',
      'Ex2'
    );

    const timetables = [
      createTimetable('t1', 'v1', 'Ex241', [
        { stationId: 'Praha', departure: '06:13', arrival: null },
        { stationId: 'Olomouc', departure: '08:20', arrival: '08:19' },
        { stationId: 'Ostrava', departure: null, arrival: '09:00' },
      ]),
      createTimetable('t2', 'v2', 'Ex251', [
        { stationId: 'Olomouc', departure: '06:20', arrival: null },
        { stationId: 'Ostrava', departure: null, arrival: '07:00' },
      ]),
      createTimetable('t3', 'v3', 'Ex263', [
        { stationId: 'Cheb', departure: '06:45', arrival: null },
        { stationId: 'Praha', departure: '09:00', arrival: '08:55' },
        { stationId: 'Olomouc', departure: '11:20', arrival: '11:19' },
        { stationId: 'Ostrava', departure: null, arrival: '12:00' },
      ]),
      createTimetable('t4', 'v4', 'Ex231', [
        { stationId: 'Cheb', departure: '18:45', arrival: null },
        { stationId: 'Praha', departure: '21:00', arrival: '20:55' },
        { stationId: 'Brno', departure: null, arrival: '22:30' },
      ]),
    ];

    const result = buildTimetableData([v1, v2, v3, v4], timetables);

    // Most trains pass through Olomouc, so use Olomouc as reference for those
    // Ex231 doesn't pass through Olomouc, should be sorted by first departure or end
    // Expected: Ex251 (06:20 at Olomouc), Ex241 (08:20 at Olomouc), Ex263 (11:20 at Olomouc), Ex231 (18:45 first dep)
    expect(result.entries.map((e) => e.trainNumber)).toEqual(['Ex251', 'Ex241', 'Ex263', 'Ex231']);
  });
});

describe('parseTimeToMinutes', () => {
  it('parses time string to minutes', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('06:00')).toBe(360);
    expect(parseTimeToMinutes('12:30')).toBe(750);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });
});

describe('isOvernightTrain', () => {
  it('detects overnight train crossing midnight', () => {
    const overnight = createTimetable('t1', 'v1', 'Train1', [
      { stationId: 'A', departure: '21:45', arrival: null },
      { stationId: 'B', departure: '23:00', arrival: '22:55' },
      { stationId: 'C', departure: '00:30', arrival: '00:25' },
    ]);

    expect(isOvernightTrain(overnight)).toBe(true);
  });

  it('returns false for daytime train', () => {
    const daytime = createTimetable('t1', 'v1', 'Train1', [
      { stationId: 'A', departure: '06:00', arrival: null },
      { stationId: 'B', departure: '08:00', arrival: '07:55' },
    ]);

    expect(isOvernightTrain(daytime)).toBe(false);
  });

  it('returns false for early morning only train', () => {
    const earlyMorning = createTimetable('t1', 'v1', 'Train1', [
      { stationId: 'A', departure: '04:00', arrival: null },
      { stationId: 'B', departure: '05:30', arrival: '05:25' },
    ]);

    expect(isOvernightTrain(earlyMorning)).toBe(false);
  });

  it('returns false for late evening only train', () => {
    const lateEvening = createTimetable('t1', 'v1', 'Train1', [
      { stationId: 'A', departure: '21:00', arrival: null },
      { stationId: 'B', departure: '23:30', arrival: '23:25' },
    ]);

    expect(isOvernightTrain(lateEvening)).toBe(false);
  });
});

describe('applyOvernightPenalty', () => {
  it('adds 24 hours to early morning times for overnight trains', () => {
    expect(applyOvernightPenalty('00:24', true)).toBe('24:24');
    expect(applyOvernightPenalty('05:30', true)).toBe('29:30');
  });

  it('does not modify evening times for overnight trains', () => {
    expect(applyOvernightPenalty('21:45', true)).toBe('21:45');
    expect(applyOvernightPenalty('23:59', true)).toBe('23:59');
  });

  it('does not modify any times for non-overnight trains', () => {
    expect(applyOvernightPenalty('00:24', false)).toBe('00:24');
    expect(applyOvernightPenalty('21:45', false)).toBe('21:45');
  });

  it('handles edge cases', () => {
    expect(applyOvernightPenalty('99:99', true)).toBe('99:99');
    expect(applyOvernightPenalty('06:00', true)).toBe('06:00'); // 06:00 is not early morning
  });
});

describe('overnight train sorting', () => {
  it('sorts overnight trains after regular trains at the same station', () => {
    // Simulate Ex2 scenario: Ex237 departs 21:45, arrives Praha 00:24 (overnight)
    // Other trains arrive Praha during the day
    const v1 = createVariant(
      'v1',
      [
        { stationId: 'Cheb', sequence: 1 },
        { stationId: 'Praha', sequence: 2 },
      ],
      'outbound',
      'Ex2'
    );

    const timetables = [
      createTimetable('t1', 'v1', 'Ex241', [
        { stationId: 'Cheb', departure: '06:00', arrival: null },
        { stationId: 'Praha', departure: null, arrival: '08:30' },
      ]),
      createTimetable('t2', 'v1', 'Ex237', [
        { stationId: 'Cheb', departure: '21:45', arrival: null },
        { stationId: 'Praha', departure: null, arrival: '00:24' }, // Overnight!
      ]),
      createTimetable('t3', 'v1', 'Ex243', [
        { stationId: 'Cheb', departure: '10:00', arrival: null },
        { stationId: 'Praha', departure: null, arrival: '12:30' },
      ]),
    ];

    const result = buildTimetableData([v1], timetables);

    // Ex237 should be last because its Praha arrival (00:24) is treated as 24:24 for sorting
    expect(result.entries.map((e) => e.trainNumber)).toEqual(['Ex241', 'Ex243', 'Ex237']);
  });
});
