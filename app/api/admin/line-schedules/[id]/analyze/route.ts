import { NextRequest, NextResponse } from 'next/server';
import { getLineSchedule, getPattern } from '@/lib/data/lineSchedules';
import { getVariant } from '@/lib/data/variants';
import { getRoutes } from '@/lib/data/routes';
import { analyzeShortTurnNeeds, getFullVariantCoverage } from '@/lib/schedule/shortTurnAnalyzer';
import { calculateTrainCount, generateDeparturePreview } from '@/lib/schedule/patternGenerator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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

    // Get the variants and routes
    const [outboundVariant, inboundVariant, routes] = await Promise.all([
      getVariant(schedule.primaryPair.outboundVariantId),
      getVariant(schedule.primaryPair.inboundVariantId),
      getRoutes(),
    ]);

    if (!outboundVariant || !inboundVariant) {
      return NextResponse.json({ error: 'Variants not found' }, { status: 404 });
    }

    // Analyze short-turn needs
    const suggestions = analyzeShortTurnNeeds(
      schedule,
      pattern,
      outboundVariant,
      inboundVariant,
      routes
    );

    // Get full variant coverage info
    const coverage = getFullVariantCoverage(
      schedule,
      pattern,
      outboundVariant,
      inboundVariant,
      routes
    );

    // Calculate train counts
    const trainCounts = calculateTrainCount(pattern);

    // Generate departure previews
    const outboundPreview = generateDeparturePreview(pattern, schedule.outboundAnchorMinute, 10);
    const inboundPreview = generateDeparturePreview(pattern, schedule.inboundAnchorMinute, 10);

    return NextResponse.json({
      suggestions,
      coverage,
      trainCounts: {
        fullOutbound: trainCounts.perDirection,
        fullInbound: trainCounts.perDirection,
        shortTurnOutbound: suggestions.filter(s => s.direction === 'outbound').reduce((sum, s) => sum + s.trainsNeeded, 0),
        shortTurnInbound: suggestions.filter(s => s.direction === 'inbound').reduce((sum, s) => sum + s.trainsNeeded, 0),
        total: trainCounts.total + suggestions.reduce((sum, s) => sum + s.trainsNeeded, 0),
      },
      departurePreview: {
        outbound: outboundPreview,
        inbound: inboundPreview,
      },
    });
  } catch (error) {
    console.error('Failed to analyze line schedule:', error);
    return NextResponse.json({ error: 'Failed to analyze line schedule' }, { status: 500 });
  }
}
