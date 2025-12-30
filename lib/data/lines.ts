import { promises as fs } from 'fs';
import path from 'path';
import { Line } from '@/types';
import { generateId } from './helpers';
import { deleteVariantsByLine } from './variants';
import { deleteTimetablesByVariant } from './timetables';

const dataPath = path.join(process.cwd(), 'data', 'lines.json');

interface LinesData {
  lines: Line[];
}

async function readLinesFile(): Promise<LinesData> {
  const data = await fs.readFile(dataPath, 'utf-8');
  return JSON.parse(data);
}

async function writeLinesFile(data: LinesData): Promise<void> {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getLines(): Promise<Line[]> {
  const parsed = await readLinesFile();
  // Sort by name with natural ordering (Ex1 before Ex11)
  return parsed.lines.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}

export async function getLine(id: string): Promise<Line | undefined> {
  const lines = await getLines();
  return lines.find((l) => l.id === id);
}

export async function getLineByIdentifier(identifier: string): Promise<Line | undefined> {
  const lines = await getLines();
  return lines.find((l) => l.identifier === identifier);
}

export async function createLine(data: Omit<Line, 'id'>): Promise<Line> {
  const file = await readLinesFile();
  const line: Line = {
    id: generateId(),
    ...data,
  };
  file.lines.push(line);
  await writeLinesFile(file);
  return line;
}

export async function updateLine(id: string, updates: Partial<Omit<Line, 'id'>>): Promise<Line> {
  const file = await readLinesFile();
  const index = file.lines.findIndex((l) => l.id === id);
  if (index === -1) {
    throw new Error(`Line with id ${id} not found`);
  }
  file.lines[index] = { ...file.lines[index], ...updates };
  await writeLinesFile(file);
  return file.lines[index];
}

export async function deleteLine(id: string): Promise<void> {
  const file = await readLinesFile();
  const index = file.lines.findIndex((l) => l.id === id);
  if (index === -1) {
    throw new Error(`Line with id ${id} not found`);
  }

  // Cascade delete: first delete timetables for all variants, then variants
  const deletedVariantIds = await deleteVariantsByLine(id);
  for (const variantId of deletedVariantIds) {
    await deleteTimetablesByVariant(variantId);
  }

  file.lines.splice(index, 1);
  await writeLinesFile(file);
}
