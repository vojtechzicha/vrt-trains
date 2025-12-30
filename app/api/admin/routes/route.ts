import { NextRequest, NextResponse } from 'next/server';
import { getRoutes, createRoute } from '@/lib/data';

export async function GET() {
  try {
    const routes = await getRoutes();
    return NextResponse.json(routes);
  } catch (error) {
    console.error('Failed to fetch routes:', error);
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Validate paths
    if (!data.paths || !Array.isArray(data.paths) || data.paths.length === 0) {
      return NextResponse.json(
        { error: 'Route must have at least one path' },
        { status: 400 }
      );
    }

    // Validate each path has stops
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

    const route = await createRoute(data);
    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    console.error('Failed to create route:', error);
    return NextResponse.json({ error: 'Failed to create route' }, { status: 500 });
  }
}
