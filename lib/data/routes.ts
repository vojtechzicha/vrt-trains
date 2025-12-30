import { promises as fs } from 'fs';
import path from 'path';
import { RouteCorridor, RoutePath, Variant } from '@/types';
import { generateId } from './helpers';

const dataPath = path.join(process.cwd(), 'data', 'routes.json');
const variantsPath = path.join(process.cwd(), 'data', 'variants.json');

interface RoutesData {
  routes: RouteCorridor[];
}

interface VariantsData {
  variants: Variant[];
}

async function readRoutesFile(): Promise<RoutesData> {
  const data = await fs.readFile(dataPath, 'utf-8');
  return JSON.parse(data);
}

async function writeRoutesFile(data: RoutesData): Promise<void> {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function readVariantsFile(): Promise<VariantsData> {
  const data = await fs.readFile(variantsPath, 'utf-8');
  return JSON.parse(data);
}

async function writeVariantsFile(data: VariantsData): Promise<void> {
  await fs.writeFile(variantsPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Basic CRUD operations

export async function getRoutes(): Promise<RouteCorridor[]> {
  const parsed = await readRoutesFile();
  // Always sort routes by name
  return parsed.routes.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getRoute(id: string): Promise<RouteCorridor | undefined> {
  const routes = await getRoutes();
  return routes.find((r) => r.id === id);
}

export async function createRoute(
  data: Omit<RouteCorridor, 'id' | 'createdAt' | 'updatedAt'>
): Promise<RouteCorridor> {
  const file = await readRoutesFile();
  const now = new Date().toISOString();

  // Generate IDs for paths if not provided
  const pathsWithIds: RoutePath[] = data.paths.map((p) => ({
    ...p,
    id: p.id || generateId(),
  }));

  const route: RouteCorridor = {
    id: generateId(),
    ...data,
    paths: pathsWithIds,
    createdAt: now,
    updatedAt: now,
  };

  file.routes.push(route);
  await writeRoutesFile(file);
  return route;
}

export async function updateRoute(
  id: string,
  updates: Partial<Omit<RouteCorridor, 'id' | 'createdAt'>>
): Promise<RouteCorridor> {
  const file = await readRoutesFile();
  const index = file.routes.findIndex((r) => r.id === id);

  if (index === -1) {
    throw new Error(`Route with id ${id} not found`);
  }

  // Generate IDs for new paths
  if (updates.paths) {
    updates.paths = updates.paths.map((p) => ({
      ...p,
      id: p.id || generateId(),
    }));
  }

  file.routes[index] = {
    ...file.routes[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeRoutesFile(file);
  return file.routes[index];
}

export async function deleteRoute(id: string): Promise<void> {
  // Check if route is referenced by any variant
  const isReferenced = await isRouteReferenced(id);
  if (isReferenced) {
    throw new Error('Cannot delete route: it is referenced by one or more variants');
  }

  const file = await readRoutesFile();
  const index = file.routes.findIndex((r) => r.id === id);

  if (index === -1) {
    throw new Error(`Route with id ${id} not found`);
  }

  file.routes.splice(index, 1);
  await writeRoutesFile(file);
}

// Query operations

export async function getRoutesByStation(stationId: string): Promise<RouteCorridor[]> {
  const routes = await getRoutes();
  return routes.filter((route) =>
    route.paths.some((path) =>
      path.stops.some((stop) => stop.stationId === stationId)
    )
  );
}

export async function getRoutePath(
  routeId: string,
  pathId: string
): Promise<RoutePath | undefined> {
  const route = await getRoute(routeId);
  if (!route) return undefined;
  return route.paths.find((p) => p.id === pathId);
}

// Reference checking

export async function isRouteReferenced(routeId: string): Promise<boolean> {
  const variantsData = await readVariantsFile();
  return variantsData.variants.some((v) =>
    v.routeRefs?.some((ref) => ref.routeId === routeId)
  );
}

export async function getVariantsReferencingRoute(routeId: string): Promise<Variant[]> {
  const variantsData = await readVariantsFile();
  return variantsData.variants.filter((v) =>
    v.routeRefs?.some((ref) => ref.routeId === routeId)
  );
}

// Sync operations

export async function flagVariantsOutOfSync(routeId: string): Promise<number> {
  const variantsData = await readVariantsFile();
  let flaggedCount = 0;

  for (const variant of variantsData.variants) {
    if (variant.routeRefs?.some((ref) => ref.routeId === routeId)) {
      variant.outOfSync = true;
      flaggedCount++;
    }
  }

  if (flaggedCount > 0) {
    await writeVariantsFile(variantsData);
  }

  return flaggedCount;
}

export async function clearVariantOutOfSync(variantId: string): Promise<void> {
  const variantsData = await readVariantsFile();
  const variant = variantsData.variants.find((v) => v.id === variantId);

  if (variant) {
    variant.outOfSync = false;
    await writeVariantsFile(variantsData);
  }
}

export async function getOutOfSyncVariants(): Promise<Variant[]> {
  const variantsData = await readVariantsFile();
  return variantsData.variants.filter((v) => v.outOfSync === true);
}

// Path lock checking (structural changes)

export async function isPathLocked(routeId: string, pathId: string): Promise<boolean> {
  const variantsData = await readVariantsFile();
  return variantsData.variants.some((v) =>
    v.routeRefs?.some((ref) => ref.routeId === routeId && ref.pathId === pathId)
  );
}
