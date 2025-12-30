import { NextRequest, NextResponse } from 'next/server';
import { getRoute, updateRoute, deleteRoute, flagVariantsOutOfSync } from '@/lib/data';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const route = await getRoute(id);

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    return NextResponse.json(route);
  } catch (error) {
    console.error('Failed to fetch route:', error);
    return NextResponse.json({ error: 'Failed to fetch route' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const data = await request.json();

    // Check if route exists
    const existingRoute = await getRoute(id);
    if (!existingRoute) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    // Validate paths if provided
    if (data.paths) {
      if (!Array.isArray(data.paths) || data.paths.length === 0) {
        return NextResponse.json(
          { error: 'Route must have at least one path' },
          { status: 400 }
        );
      }

      for (const path of data.paths) {
        if (!path.name) {
          return NextResponse.json(
            { error: 'Each path must have a name' },
            { status: 400 }
          );
        }
        if (!path.stops || !Array.isArray(path.stops) || path.stops.length < 2) {
          return NextResponse.json(
            { error: 'Each path must have at least 2 stops' },
            { status: 400 }
          );
        }
      }
    }

    const route = await updateRoute(id, data);

    // Flag all variants referencing this route as out-of-sync
    const flaggedCount = await flagVariantsOutOfSync(id);

    return NextResponse.json({
      ...route,
      _meta: {
        variantsFlagged: flaggedCount,
      },
    });
  } catch (error) {
    console.error('Failed to update route:', error);
    const message = error instanceof Error ? error.message : 'Failed to update route';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteRoute(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete route:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete route';
    const status = message.includes('referenced') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
