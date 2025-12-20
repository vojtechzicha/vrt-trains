import { promises as fs } from 'fs';
import path from 'path';
import { Timetable, OperatingDay, TimetableDeparture, Variant } from '@/types';
import { generateId, addMinutesToTime } from './helpers';

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
}

export async function generateTimetables(params: GenerateTimetablesParams): Promise<Timetable[]> {
  const { variant, firstDeparture, interval, endTime, operatingDays, trainNumberPrefix } = params;

  const generatedTimetables: Timetable[] = [];
  let currentDeparture = firstDeparture;
  let trainNumber = 1;

  // Parse end time for comparison
  const [endHours, endMins] = endTime.split(':').map(Number);
  const endMinutes = endHours * 60 + endMins;

  while (true) {
    const [currentHours, currentMins] = currentDeparture.split(':').map(Number);
    const currentMinutes = currentHours * 60 + currentMins;

    // Stop if we've passed the end time
    if (currentMinutes > endMinutes) break;

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
        platform: stop.platform,
      };
    });

    const timetable: Omit<Timetable, 'id'> = {
      variantId: variant.id,
      trainNumber: `${trainNumberPrefix}-${String(trainNumber).padStart(3, '0')}`,
      operatingDays,
      departures,
    };

    generatedTimetables.push({
      id: generateId(),
      ...timetable,
    });

    // Move to next departure
    currentDeparture = addMinutesToTime(currentDeparture, interval);
    trainNumber++;

    // Safety limit
    if (trainNumber > 100) break;
  }

  // Save all generated timetables
  const file = await readTimetablesFile();
  file.timetables.push(...generatedTimetables);
  await writeTimetablesFile(file);

  return generatedTimetables;
}
