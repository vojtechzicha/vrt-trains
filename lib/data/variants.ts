import { promises as fs } from 'fs';
import path from 'path';
import { Variant } from '@/types';
import { generateId } from './helpers';

const dataPath = path.join(process.cwd(), 'data', 'variants.json');

interface VariantsData {
  variants: Variant[];
}

async function readVariantsFile(): Promise<VariantsData> {
  const data = await fs.readFile(dataPath, 'utf-8');
  return JSON.parse(data);
}

async function writeVariantsFile(data: VariantsData): Promise<void> {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getVariants(): Promise<Variant[]> {
  const parsed = await readVariantsFile();
  return parsed.variants;
}

export async function getVariant(id: string): Promise<Variant | undefined> {
  const variants = await getVariants();
  return variants.find((v) => v.id === id);
}

export async function getVariantsByLine(lineId: string): Promise<Variant[]> {
  const variants = await getVariants();
  return variants.filter((v) => v.lineId === lineId);
}

export async function getVariantsByStation(stationId: string): Promise<Variant[]> {
  const variants = await getVariants();
  return variants.filter((v) =>
    v.stations.some((s) => s.stationId === stationId)
  );
}

export async function createVariant(data: Omit<Variant, 'id'>): Promise<Variant> {
  const file = await readVariantsFile();
  const variant: Variant = {
    id: generateId(),
    ...data,
  };
  file.variants.push(variant);
  await writeVariantsFile(file);
  return variant;
}

export async function updateVariant(id: string, updates: Partial<Omit<Variant, 'id'>>): Promise<Variant> {
  const file = await readVariantsFile();
  const index = file.variants.findIndex((v) => v.id === id);
  if (index === -1) {
    throw new Error(`Variant with id ${id} not found`);
  }
  file.variants[index] = { ...file.variants[index], ...updates };
  await writeVariantsFile(file);
  return file.variants[index];
}

export async function deleteVariant(id: string): Promise<void> {
  const file = await readVariantsFile();
  const index = file.variants.findIndex((v) => v.id === id);
  if (index === -1) {
    throw new Error(`Variant with id ${id} not found`);
  }
  file.variants.splice(index, 1);
  await writeVariantsFile(file);
}

export async function deleteVariantsByLine(lineId: string): Promise<string[]> {
  const file = await readVariantsFile();
  const deletedVariantIds = file.variants
    .filter((v) => v.lineId === lineId)
    .map((v) => v.id);
  file.variants = file.variants.filter((v) => v.lineId !== lineId);
  await writeVariantsFile(file);
  return deletedVariantIds;
}

export async function duplicateVariant(
  sourceId: string,
  options: { code: string; name: string; truncateAtStationId?: string }
): Promise<Variant> {
  const source = await getVariant(sourceId);
  if (!source) {
    throw new Error(`Source variant with id ${sourceId} not found`);
  }

  let stations = [...source.stations];

  // Truncate if a station ID is provided
  if (options.truncateAtStationId) {
    const truncateIndex = stations.findIndex(
      (s) => s.stationId === options.truncateAtStationId
    );
    if (truncateIndex !== -1) {
      stations = stations.slice(0, truncateIndex + 1);
      // Note: Last station is implicitly terminal (departure calculated as null on-the-fly)
    }
  }

  const newVariant: Omit<Variant, 'id'> = {
    lineId: source.lineId,
    code: options.code,
    name: options.name,
    direction: source.direction,
    routeRefs: source.routeRefs || [],
    stations: stations.map((s, i) => ({ ...s, sequence: i + 1 })),
  };

  return createVariant(newVariant);
}

export async function updateVariantPlatformAtStation(
  variantId: string,
  stationId: string,
  platform: string
): Promise<Variant> {
  const file = await readVariantsFile();
  const index = file.variants.findIndex((v) => v.id === variantId);
  if (index === -1) {
    throw new Error(`Variant with id ${variantId} not found`);
  }

  const variant = file.variants[index];
  const stationIndex = variant.stations.findIndex((s) => s.stationId === stationId);
  if (stationIndex === -1) {
    throw new Error(`Station ${stationId} not found in variant ${variantId}`);
  }

  variant.stations[stationIndex] = {
    ...variant.stations[stationIndex],
    platform,
  };

  await writeVariantsFile(file);
  return variant;
}

export async function updateMultipleVariantPlatforms(
  updates: { variantId: string; stationId: string; platform: string }[]
): Promise<void> {
  const file = await readVariantsFile();

  for (const update of updates) {
    const variant = file.variants.find((v) => v.id === update.variantId);
    if (!variant) continue;

    const stationIndex = variant.stations.findIndex((s) => s.stationId === update.stationId);
    if (stationIndex === -1) continue;

    variant.stations[stationIndex] = {
      ...variant.stations[stationIndex],
      platform: update.platform,
    };
  }

  await writeVariantsFile(file);
}
