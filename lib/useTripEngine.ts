'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TripEngine, type TripSnapshot, type LatLng } from './tripEngine';
export type { LatLng } from './tripEngine';

const EMPTY_SNAPSHOT: TripSnapshot = {
  trip: null,
  fleet: [],
  assignedDriverPosition: null,
};

export function useTripEngine() {
  const engineRef = useRef<TripEngine | null>(null);
  const [snapshot, setSnapshot] = useState<TripSnapshot>(EMPTY_SNAPSHOT);

  // Create engine once, destroy on unmount
  useEffect(() => {
    const engine = new TripEngine();
    engineRef.current = engine;
    const unsub = engine.subscribe(setSnapshot);
    return () => {
      unsub();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const setPickup = useCallback((pickup: LatLng | null) => {
    engineRef.current?.setPickup(pickup);
  }, []);

  const setDropoff = useCallback((dropoff: LatLng | null) => {
    engineRef.current?.setDropoff(dropoff);
  }, []);

  const startTrip = useCallback((pickup: LatLng, dropoff: LatLng | null) => {
    engineRef.current?.startTrip(pickup, dropoff);
  }, []);

  return { snapshot, setPickup, setDropoff, startTrip };
}
