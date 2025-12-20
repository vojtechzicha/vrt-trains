import { promises as fs } from 'fs';
import path from 'path';
import { Station } from '@/types';
import { generateId } from './helpers';

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
  file.stations[index] = { ...file.stations[index], ...updates };
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
