import { promises as fs } from 'fs';
import path from 'path';
import { Station, Platform } from '@/types';
import { generateId } from './helpers';
import { getVariantsByStation, updateMultipleVariantPlatforms } from './variants';
import { getPlatformCodes } from '../platforms/helpers';

const dataPath = path.join(process.cwd(), 'data', 'stations.json');

interface StationsData {
  stations: Station[];
}

async function readStationsFile(): Promise<StationsData> {
  const data = await fs.readFile(dataPath, 'utf-8');
  return JSON.parse(data);
}

async function writeStationsFile(data: StationsData): Promise<void> {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getStations(): Promise<Station[]> {
  const parsed = await readStationsFile();
  return parsed.stations.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getStation(id: string): Promise<Station | undefined> {
  const stations = await getStations();
  return stations.find((s) => s.id === id);
}

export async function getStationByCode(code: string): Promise<Station | undefined> {
  const stations = await getStations();
  return stations.find((s) => s.code === code);
}

export async function createStation(data: Omit<Station, 'id'>): Promise<Station> {
  const file = await readStationsFile();
  const station: Station = {
    id: generateId(),
    ...data,
  };
  file.stations.push(station);
  await writeStationsFile(file);
  return station;
}

export async function updateStation(id: string, updates: Partial<Omit<Station, 'id'>>): Promise<Station> {
  const file = await readStationsFile();
  const index = file.stations.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error(`Station with id ${id} not found`);
  }

  const oldStation = file.stations[index];

  // Handle platform deletion cascade - clear assignments for removed platforms
  if (updates.platforms && Array.isArray(updates.platforms)) {
    const newCodes = new Set(getPlatformCodes(updates.platforms));
    const oldCodes = new Set(getPlatformCodes(oldStation.platforms || []));

    // Find removed platform codes
    const removedCodes = [...oldCodes].filter((code) => !newCodes.has(code));

    if (removedCodes.length > 0) {
      // Get all variants that serve this station
      const variants = await getVariantsByStation(id);

      // Find variants with assignments to removed platforms and clear them
      const platformUpdates: { variantId: string; stationId: string; platform: string }[] = [];

      for (const variant of variants) {
        const stop = variant.stations.find((s) => s.stationId === id);
        if (stop && removedCodes.includes(stop.platform)) {
          platformUpdates.push({
            variantId: variant.id,
            stationId: id,
            platform: '', // Clear the assignment
          });
        }
      }

      if (platformUpdates.length > 0) {
        await updateMultipleVariantPlatforms(platformUpdates);
      }
    }
  }

  file.stations[index] = { ...oldStation, ...updates };
  await writeStationsFile(file);
  return file.stations[index];
}

export async function deleteStation(id: string): Promise<void> {
  const file = await readStationsFile();
  const index = file.stations.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error(`Station with id ${id} not found`);
  }
  file.stations.splice(index, 1);
  await writeStationsFile(file);
}

// Virtual station functions
export async function getVirtualStations(): Promise<Station[]> {
  const stations = await getStations();
  return stations.filter((s) => s.isVirtual === true);
}

export async function getPhysicalStations(): Promise<Station[]> {
  const stations = await getStations();
  return stations.filter((s) => !s.isVirtual);
}

export async function getMemberStations(virtualStationId: string): Promise<Station[]> {
  const virtualStation = await getStation(virtualStationId);
  if (!virtualStation || !virtualStation.isVirtual || !virtualStation.memberStationIds) {
    return [];
  }

  const allStations = await getStations();
  const stationMap = new Map(allStations.map((s) => [s.id, s]));

  return virtualStation.memberStationIds
    .map((id) => stationMap.get(id))
    .filter((s): s is Station => s !== undefined);
}
