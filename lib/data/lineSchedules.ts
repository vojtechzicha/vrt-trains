import { promises as fs } from 'fs';
import path from 'path';
import { OperatingPattern, LineSchedule } from '@/types';
import { generateId } from './helpers';

const dataPath = path.join(process.cwd(), 'data', 'lineSchedules.json');

interface LineSchedulesData {
  patterns: OperatingPattern[];
  lineSchedules: LineSchedule[];
}

async function readDataFile(): Promise<LineSchedulesData> {
  const data = await fs.readFile(dataPath, 'utf-8');
  return JSON.parse(data);
}

async function writeDataFile(data: LineSchedulesData): Promise<void> {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Pattern CRUD operations
export async function getPatterns(): Promise<OperatingPattern[]> {
  const data = await readDataFile();
  return data.patterns;
}

export async function getPattern(id: string): Promise<OperatingPattern | undefined> {
  const patterns = await getPatterns();
  return patterns.find((p) => p.id === id);
}

export async function createPattern(patternData: Omit<OperatingPattern, 'id'>): Promise<OperatingPattern> {
  const data = await readDataFile();
  const pattern: OperatingPattern = {
    id: generateId(),
    ...patternData,
  };
  data.patterns.push(pattern);
  await writeDataFile(data);
  return pattern;
}

export async function updatePattern(
  id: string,
  updates: Partial<Omit<OperatingPattern, 'id'>>
): Promise<OperatingPattern> {
  const data = await readDataFile();
  const index = data.patterns.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error(`Pattern with id ${id} not found`);
  }
  data.patterns[index] = { ...data.patterns[index], ...updates };
  await writeDataFile(data);
  return data.patterns[index];
}

export async function deletePattern(id: string): Promise<void> {
  const data = await readDataFile();
  const index = data.patterns.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error(`Pattern with id ${id} not found`);
  }
  // Check if any line schedules use this pattern
  const usedBy = data.lineSchedules.filter((ls) => ls.patternId === id);
  if (usedBy.length > 0) {
    throw new Error(`Pattern is used by ${usedBy.length} line schedule(s)`);
  }
  data.patterns.splice(index, 1);
  await writeDataFile(data);
}

// Line Schedule CRUD operations
export async function getLineSchedules(): Promise<LineSchedule[]> {
  const data = await readDataFile();
  return data.lineSchedules;
}

export async function getLineSchedule(id: string): Promise<LineSchedule | undefined> {
  const schedules = await getLineSchedules();
  return schedules.find((s) => s.id === id);
}

export async function getLineScheduleByLine(lineId: string): Promise<LineSchedule | undefined> {
  const schedules = await getLineSchedules();
  return schedules.find((s) => s.lineId === lineId);
}

export async function createLineSchedule(scheduleData: Omit<LineSchedule, 'id'>): Promise<LineSchedule> {
  const data = await readDataFile();

  // Check if a schedule already exists for this line
  const existing = data.lineSchedules.find((s) => s.lineId === scheduleData.lineId);
  if (existing) {
    throw new Error(`A schedule already exists for line ${scheduleData.lineId}`);
  }

  const schedule: LineSchedule = {
    id: generateId(),
    ...scheduleData,
  };
  data.lineSchedules.push(schedule);
  await writeDataFile(data);
  return schedule;
}

export async function updateLineSchedule(
  id: string,
  updates: Partial<Omit<LineSchedule, 'id'>>
): Promise<LineSchedule> {
  const data = await readDataFile();
  const index = data.lineSchedules.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error(`Line schedule with id ${id} not found`);
  }
  data.lineSchedules[index] = { ...data.lineSchedules[index], ...updates };
  await writeDataFile(data);
  return data.lineSchedules[index];
}

export async function deleteLineSchedule(id: string): Promise<void> {
  const data = await readDataFile();
  const index = data.lineSchedules.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error(`Line schedule with id ${id} not found`);
  }
  data.lineSchedules.splice(index, 1);
  await writeDataFile(data);
}

// Utility function to get schedule with pattern resolved
export async function getLineScheduleWithPattern(
  id: string
): Promise<{ schedule: LineSchedule; pattern: OperatingPattern } | undefined> {
  const schedule = await getLineSchedule(id);
  if (!schedule) return undefined;

  const pattern = await getPattern(schedule.patternId);
  if (!pattern) return undefined;

  return { schedule, pattern };
}
