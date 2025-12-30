import { NextRequest, NextResponse } from 'next/server';
import { getLineSchedule, getPattern } from '@/lib/data/lineSchedules';
import { getVariant, getVariantsByLine } from '@/lib/data/variants';
import { getRoutes } from '@/lib/data/routes';
import { getTimetables, deleteTimetablesByVariant, getAllTrainNumbers } from '@/lib/data/timetables';
import { generateTimetables } from '@/lib/schedule/patternGenerator';
import { promises as fs } from 'fs';
import path from 'path';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface GenerateRequest {
  clearExisting?: boolean;
  shortTurnVariants?: {
    outboundMorningId?: string;
    inboundMorningId?: string;
    outboundEveningId?: string;
    inboundEveningId?: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body: GenerateRequest = await request.json();

    // Get the schedule
    const schedule = await getLineSchedule(id);
    if (!schedule) {
      return NextResponse.json({ error: 'Line schedule not found' }, { status: 404 });
    }

    // Get the pattern
    const pattern = await getPattern(schedule.patternId);
    if (!pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
    }

    // Get the primary variants and routes
    const [outboundVariant, inboundVariant, routes] = await Promise.all([
      getVariant(schedule.primaryPair.outboundVariantId),
      getVariant(schedule.primaryPair.inboundVariantId),
      getRoutes(),
    ]);

    if (!outboundVariant || !inboundVariant) {
      return NextResponse.json({ error: 'Variants not found' }, { status: 404 });
    }

    // Get short-turn variants if provided
    const shortTurnVariants: {
      outboundMorning?: typeof outboundVariant;
      inboundMorning?: typeof inboundVariant;
      outboundEvening?: typeof outboundVariant;
      inboundEvening?: typeof inboundVariant;
    } = {};

    if (body.shortTurnVariants?.outboundMorningId) {
      shortTurnVariants.outboundMorning = await getVariant(body.shortTurnVariants.outboundMorningId);
    }
    if (body.shortTurnVariants?.inboundMorningId) {
      shortTurnVariants.inboundMorning = await getVariant(body.shortTurnVariants.inboundMorningId);
    }
    if (body.shortTurnVariants?.outboundEveningId) {
      shortTurnVariants.outboundEvening = await getVariant(body.shortTurnVariants.outboundEveningId);
    }
    if (body.shortTurnVariants?.inboundEveningId) {
      shortTurnVariants.inboundEvening = await getVariant(body.shortTurnVariants.inboundEveningId);
    }

    // Clear existing timetables if requested
    if (body.clearExisting) {
      const lineVariants = await getVariantsByLine(schedule.lineId);
      for (const variant of lineVariants) {
        await deleteTimetablesByVariant(variant.id);
      }
    }

    // Get existing train numbers to avoid duplicates
    const existingNumbers = new Set(await getAllTrainNumbers());

    // Generate timetables
    const { outboundTimetables, inboundTimetables } = generateTimetables(
      {
        schedule,
        pattern,
        outboundVariant,
        inboundVariant,
        routes,
        shortTurnVariants,
      },
      existingNumbers
    );

    // Save generated timetables
    const dataPath = path.join(process.cwd(), 'data', 'timetables.json');
    const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
    data.timetables.push(...outboundTimetables, ...inboundTimetables);
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      generated: {
        outbound: outboundTimetables.length,
        inbound: inboundTimetables.length,
        total: outboundTimetables.length + inboundTimetables.length,
      },
    });
  } catch (error) {
    console.error('Failed to generate timetables:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate timetables';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
