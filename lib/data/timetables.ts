import { promises as fs } from 'fs';
import path from 'path';
import { Timetable, OperatingDay, TimetableDeparture, Variant } from '@/types';
import { generateId, addMinutesToTime } from './helpers';
import { calculateCoreNumber, formatTrainNumber } from '@/lib/trainNumbers';

const dataPath = path.join(process.cwd(), 'data', 'timetables.json');

interface TimetablesData {
  timetables: Timetable[];
}

async function readTimetablesFile(): Promise<TimetablesData> {
  const data = await fs.readFile(dataPath, 'utf-8');
  return JSON.parse(data);
}

async function writeTimetablesFile(data: TimetablesData): Promise<void> {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getTimetables(): Promise<Timetable[]> {
  const parsed = await readTimetablesFile();
  return parsed.timetables;
}

export async function getTimetable(id: string): Promise<Timetable | undefined> {
  const timetables = await getTimetables();
  return timetables.find((t) => t.id === id);
}

export async function getTimetablesByVariant(variantId: string): Promise<Timetable[]> {
  const timetables = await getTimetables();
  return timetables.filter((t) => t.variantId === variantId);
}

export async function getTimetablesByVariants(variantIds: string[]): Promise<Timetable[]> {
  const timetables = await getTimetables();
  return timetables.filter((t) => variantIds.includes(t.variantId));
}

function matchesDay(operatingDays: OperatingDay[], day: OperatingDay): boolean {
  if (operatingDays.includes(day)) return true;
  if (operatingDays.includes('weekdays') && ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(day)) {
    return true;
  }
  if (operatingDays.includes('weekends') && ['saturday', 'sunday'].includes(day)) {
    return true;
  }
  return false;
}

export async function getTimetablesByDay(day: OperatingDay): Promise<Timetable[]> {
  const timetables = await getTimetables();
  return timetables.filter((t) => matchesDay(t.operatingDays, day));
}

/**
 * Get all train numbers currently in use
 */
export async function getAllTrainNumbers(): Promise<string[]> {
  const timetables = await getTimetables();
  return timetables.map((t) => t.trainNumber);
}

/**
 * Check if a train number is unique across all timetables
 * @param trainNumber - The train number to check
 * @param excludeId - Optional timetable ID to exclude (for edit operations)
 */
export async function isTrainNumberUnique(trainNumber: string, excludeId?: string): Promise<boolean> {
  const timetables = await getTimetables();
  return !timetables.some((t) => t.trainNumber === trainNumber && t.id !== excludeId);
}

export async function createTimetable(data: Omit<Timetable, 'id'>): Promise<Timetable> {
  const file = await readTimetablesFile();
  const timetable: Timetable = {
    id: generateId(),
    ...data,
  };
  file.timetables.push(timetable);
  await writeTimetablesFile(file);
  return timetable;
}

export async function updateTimetable(id: string, updates: Partial<Omit<Timetable, 'id'>>): Promise<Timetable> {
  const file = await readTimetablesFile();
  const index = file.timetables.findIndex((t) => t.id === id);
  if (index === -1) {
    throw new Error(`Timetable with id ${id} not found`);
  }
  file.timetables[index] = { ...file.timetables[index], ...updates };
  await writeTimetablesFile(file);
  return file.timetables[index];
}

export async function deleteTimetable(id: string): Promise<void> {
  const file = await readTimetablesFile();
  const index = file.timetables.findIndex((t) => t.id === id);
  if (index === -1) {
    throw new Error(`Timetable with id ${id} not found`);
  }
  file.timetables.splice(index, 1);
  await writeTimetablesFile(file);
}

export async function deleteTimetablesByVariant(variantId: string): Promise<void> {
  const file = await readTimetablesFile();
  file.timetables = file.timetables.filter((t) => t.variantId !== variantId);
  await writeTimetablesFile(file);
}

interface GenerateTimetablesParams {
  variant: Variant;
  firstDeparture: string;
  interval: number;
  endTime: string;
  operatingDays: OperatingDay[];
  trainNumberPrefix: string;
  startBaseNumber: number;
}

export async function generateTimetables(params: GenerateTimetablesParams): Promise<Timetable[]> {
  const { variant, firstDeparture, interval, endTime, operatingDays, trainNumberPrefix, startBaseNumber } = params;

  const generatedTimetables: Timetable[] = [];
  let currentDeparture = firstDeparture;
  let baseNumber = startBaseNumber;

  // Get existing train numbers to check for duplicates
  const existingNumbers = new Set(await getAllTrainNumbers());

  // Parse end time for comparison
  const [endHours, endMins] = endTime.split(':').map(Number);
  const endMinutes = endHours * 60 + endMins;

  let trainCount = 0;

  while (true) {
    const [currentHours, currentMins] = currentDeparture.split(':').map(Number);
    const currentMinutes = currentHours * 60 + currentMins;

    // Stop if we've passed the end time
    if (currentMinutes > endMinutes) break;

    // Calculate train number using odd/even rule
    const coreNumber = calculateCoreNumber(baseNumber, variant.direction);
    const trainNumber = formatTrainNumber(trainNumberPrefix, coreNumber);

    // Skip if duplicate
    if (existingNumbers.has(trainNumber)) {
      baseNumber++;
      continue;
    }
    existingNumbers.add(trainNumber);

    // Generate departures for this train
    const departures: TimetableDeparture[] = variant.stations.map((stop) => {
      const arrival = stop.arrivalOffset !== null
        ? addMinutesToTime(currentDeparture, stop.arrivalOffset)
        : null;
      const departure = stop.departureOffset !== null
        ? addMinutesToTime(currentDeparture, stop.departureOffset)
        : null;

      return {
        stationId: stop.stationId,
        arrival,
        departure,
      };
    });

    const timetable: Omit<Timetable, 'id'> = {
      variantId: variant.id,
      trainNumber,
      operatingDays,
      departures,
    };

    generatedTimetables.push({
      id: generateId(),
      ...timetable,
    });

    // Move to next departure
    currentDeparture = addMinutesToTime(currentDeparture, interval);
    baseNumber += 2; // Increment by 2 to get next odd/even number
    trainCount++;

    // Safety limit
    if (trainCount > 100) break;
  }

  // Save all generated timetables
  const file = await readTimetablesFile();
  file.timetables.push(...generatedTimetables);
  await writeTimetablesFile(file);

  return generatedTimetables;
}

/**
 * Bulk offset all departure/arrival times for timetables of given variants
 * @param variantIds - Array of variant IDs to update
 * @param offsetMinutes - Minutes to offset (positive = forward, negative = back)
 * @returns Number of timetables updated
 */
export async function bulkOffsetTimetables(
  variantIds: string[],
  offsetMinutes: number
): Promise<number> {
  const file = await readTimetablesFile();
  const variantIdSet = new Set(variantIds);
  let updatedCount = 0;

  file.timetables = file.timetables.map((timetable) => {
    if (!variantIdSet.has(timetable.variantId)) {
      return timetable;
    }

    // Offset all departure/arrival times
    const updatedDepartures = timetable.departures.map((dep) => ({
      stationId: dep.stationId,
      arrival: dep.arrival ? addMinutesToTime(dep.arrival, offsetMinutes) : null,
      departure: dep.departure ? addMinutesToTime(dep.departure, offsetMinutes) : null,
    }));

    updatedCount++;
    return {
      ...timetable,
      departures: updatedDepartures,
    };
  });

  await writeTimetablesFile(file);
  return updatedCount;
}
