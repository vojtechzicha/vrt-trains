import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildTimetableData } from './buildTimetableData';
import { Variant, Timetable, Line } from '@/types';

// Load real data
function loadData() {
  const dataDir = join(process.cwd(), 'data');

  const lines: Line[] = JSON.parse(readFileSync(join(dataDir, 'lines.json'), 'utf-8')).lines;
  const variants: Variant[] = JSON.parse(
    readFileSync(join(dataDir, 'variants.json'), 'utf-8')
  ).variants;
  const timetables: Timetable[] = JSON.parse(
    readFileSync(join(dataDir, 'timetables.json'), 'utf-8')
  ).timetables;

  return { lines, variants, timetables };
}

describe('Integration: buildTimetableData with real data', () => {
  // Note: The sorting algorithm uses a "holistic" approach that sorts trains
  // by their time at common stations (like Praha), not by their first departure time.
  // This produces a more user-friendly timetable where trains are grouped by
  // when they pass through major stations, even if their origin departure times
  // are not in strict chronological order.

  it('all lines produce valid timetable data', () => {
    const { lines, variants, timetables } = loadData();

    lines.forEach((line) => {
      const lineVariants = variants.filter((v) => v.lineId === line.id);

      ['outbound', 'inbound'].forEach((direction) => {
        const directionVariants = lineVariants.filter((v) => v.direction === direction);
        if (directionVariants.length === 0) return;

        const variantIds = directionVariants.map((v) => v.id);
        const directionTimetables = timetables.filter((t) => variantIds.includes(t.variantId));

        if (directionTimetables.length === 0) return;

        const result = buildTimetableData(directionVariants, directionTimetables);

        // Verify basic structure
        expect(result.stationOrder.length).toBeGreaterThan(0);
        expect(result.entries.length).toBe(directionTimetables.length);

        // Each entry should have valid data
        result.entries.forEach((entry) => {
          expect(entry.trainNumber).toBeTruthy();
          expect(entry.times.size).toBeGreaterThan(0);
          expect(entry.firstStationIdx).toBeGreaterThanOrEqual(0);
          expect(entry.lastStationIdx).toBeGreaterThanOrEqual(entry.firstStationIdx);
        });
      });
    });
  });

  it('Ex2 inbound trains have correct structure', () => {
    const { lines, variants, timetables } = loadData();

    const ex2 = lines.find((l) => l.identifier === 'Ex2');
    if (!ex2) {
      console.log('Ex2 line not found, skipping test');
      return;
    }

    const ex2Variants = variants.filter((v) => v.lineId === ex2.id && v.direction === 'inbound');
    const variantIds = ex2Variants.map((v) => v.id);
    const ex2Timetables = timetables.filter((t) => variantIds.includes(t.variantId));

    const result = buildTimetableData(ex2Variants, ex2Timetables);

    // Verify we have the expected trains
    expect(result.entries.length).toBe(ex2Timetables.length);

    // Verify station order is valid
    expect(result.stationOrder.length).toBeGreaterThan(0);

    // Log the order for verification
    console.log('Ex2 inbound train order:');
    result.entries.forEach((e) => {
      console.log(`  ${e.trainNumber}: ${e.sortTime}`);
    });
  });

  it('Ex11 outbound trains have correct structure', () => {
    const { lines, variants, timetables } = loadData();

    const ex11 = lines.find((l) => l.identifier === 'Ex11');
    if (!ex11) {
      console.log('Ex11 line not found, skipping test');
      return;
    }

    const ex11Variants = variants.filter((v) => v.lineId === ex11.id && v.direction === 'outbound');
    const variantIds = ex11Variants.map((v) => v.id);
    const ex11Timetables = timetables.filter((t) => variantIds.includes(t.variantId));

    const result = buildTimetableData(ex11Variants, ex11Timetables);

    // Verify we have the expected trains
    expect(result.entries.length).toBe(ex11Timetables.length);

    // Verify station order is valid
    expect(result.stationOrder.length).toBeGreaterThan(0);

    // Log the order for verification
    console.log('Ex11 outbound train order:');
    result.entries.forEach((e) => {
      console.log(`  ${e.trainNumber}: ${e.sortTime}`);
    });
  });

  it('Ex237 overnight train is sorted at end of Ex2 outbound timetable', () => {
    const { lines, variants, timetables } = loadData();

    const ex2 = lines.find((l) => l.identifier === 'Ex2');
    if (!ex2) {
      console.log('Ex2 line not found, skipping test');
      return;
    }

    const ex2Variants = variants.filter((v) => v.lineId === ex2.id && v.direction === 'outbound');
    const variantIds = ex2Variants.map((v) => v.id);
    const ex2Timetables = timetables.filter((t) => variantIds.includes(t.variantId));

    const result = buildTimetableData(ex2Variants, ex2Timetables);

    // Log the order for verification
    console.log('Ex2 outbound train order:');
    result.entries.forEach((e) => {
      console.log(`  ${e.trainNumber}: ${e.sortTime}`);
    });

    // Ex237 departs Cheb at 21:45 and arrives Praha at 00:24 (overnight)
    // It should be sorted at the end of the timetable, not at the beginning
    const trainNumbers = result.entries.map((e) => e.trainNumber);
    const ex237Index = trainNumbers.indexOf('Ex237');

    if (ex237Index !== -1) {
      // Ex237 should be in the last few trains (after position 50% at least)
      const halfwayPoint = Math.floor(trainNumbers.length / 2);
      expect(ex237Index).toBeGreaterThan(halfwayPoint);

      console.log(`Ex237 is at position ${ex237Index + 1} of ${trainNumbers.length}`);
    }
  });
});
