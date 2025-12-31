/**
 * Migration script to convert station platforms from number to Platform[].
 *
 * Before: { "platforms": 5 }
 * After:  { "platforms": [{ "code": "1", "name": "", "isBay": false }, ...] }
 *
 * Run with: npx ts-node scripts/migrate-platforms.ts
 */

import { promises as fs } from 'fs';
import path from 'path';

interface OldStation {
  id: string;
  code: string;
  name: string;
  type: string;
  platforms: number;
  isTerminal: boolean;
  country?: string;
  isVirtual?: boolean;
  memberStationIds?: string[];
}

interface Platform {
  code: string;
  name: string;
  isBay: boolean;
}

interface NewStation extends Omit<OldStation, 'platforms'> {
  platforms: Platform[];
}

async function migrate() {
  const dataPath = path.join(process.cwd(), 'data', 'stations.json');
  const backupPath = path.join(
    process.cwd(),
    'data',
    `stations.json.backup-${Date.now()}`
  );

  console.log('Reading stations data...');
  const data = await fs.readFile(dataPath, 'utf-8');
  const parsed = JSON.parse(data) as { stations: OldStation[] };

  // Check if already migrated
  const firstStation = parsed.stations[0];
  if (firstStation && Array.isArray(firstStation.platforms)) {
    console.log('Stations already migrated to new format. Skipping.');
    return;
  }

  // Create backup
  await fs.writeFile(backupPath, data, 'utf-8');
  console.log('Backup created at:', backupPath);

  // Migrate each station
  let migratedCount = 0;
  const migratedStations: NewStation[] = parsed.stations.map((station) => {
    const platformCount =
      typeof station.platforms === 'number' ? station.platforms : 0;

    const platforms: Platform[] = Array.from({ length: platformCount }, (_, i) => ({
      code: String(i + 1),
      name: '',
      isBay: false,
    }));

    migratedCount++;
    return {
      ...station,
      platforms,
    };
  });

  // Write migrated data
  await fs.writeFile(
    dataPath,
    JSON.stringify({ stations: migratedStations }, null, 2),
    'utf-8'
  );

  console.log(`Successfully migrated ${migratedCount} stations.`);
  console.log('Migration complete!');
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
