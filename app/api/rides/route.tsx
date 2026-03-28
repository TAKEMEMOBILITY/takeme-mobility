import { NextRequest, NextResponse } from 'next/server';
import { RIDE_TYPES } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    if (request.method !== 'GET') {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const rideTypes = RIDE_TYPES.map((rt) => ({
      id: rt.id,
      name: rt.name,
      description: rt.description,
      price: '$12.50',
      time: '5 min',
    }));

    if (!rideTypes.length) {
      throw new Error('No ride types available');
    }

    return NextResponse.json({ rideTypes }, { status: 200 });
  } catch (error) {
    console.error('GET /api/rides failed:', error);
    return NextResponse.json({ error: 'Failed to fetch rides. Please try again later.' }, { status: 500 });
  }
}

