import { NextResponse } from 'next/server';
import { clearAllOutOfSync } from '@/lib/data';

export async function POST() {
  try {
    const clearedCount = await clearAllOutOfSync();
    return NextResponse.json({ clearedCount });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear out of sync flags' }, { status: 500 });
  }
}
