'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TAKEME ADMIN — Live Map
// Full-screen dark map showing driver positions and active rides.
// Uses simulated positioned-dot map (Leaflet not installed).
// Polls /api/admin/drivers every 5 seconds.
// ═══════════════════════════════════════════════════════════════════════════

interface Driver {
  id: string;
  full_name: string;
  email: string;
  status: string;
  rating: number;
  total_trips: number;
  location_lat: number | null;
  location_lng: number | null;
  heading: number | null;
  speed_kmh: number | null;
  last_location_at: string | null;
  vehicle: {
    vehicle_class: string;
    make: string;
    model: string;
    color: string;
    plate_number: string;
  } | null;
}

interface Ride {
  id: string;
  status: string;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  estimated_fare: number;
  final_fare: number | null;
  driver_name: string | null;
  rider_name: string | null;
  assigned_driver_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  available: '#10b981',
  busy: '#eab308',
  on_trip: '#ef4444',
  offline: '#6b7280',
};

const ACTIVE_RIDE_STATUSES = ['searching_driver', 'driver_assigned', 'driver_arriving', 'arrived', 'in_progress'];

// Default map center (Seattle area)
const DEFAULT_CENTER = { lat: 47.6062, lng: -122.3321 };
const DEFAULT_ZOOM = 12;

export default function AdminMapPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const mapRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [driversRes, ridesRes] = await Promise.all([
        fetch('/api/admin/drivers'),
        fetch('/api/admin/rides?status=active&limit=100'),
      ]);

      if (driversRes.ok) {
        const d = await driversRes.json();
        setDrivers(d.drivers ?? []);
      }
      if (ridesRes.ok) {
        const r = await ridesRes.json();
        setRides(r.rides ?? []);
      }
      setError('');
    } catch {
      setError('Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Convert lat/lng to pixel position on our simulated map
  const latLngToPixel = useCallback(
    (lat: number, lng: number) => {
      if (!mapRef.current) return { x: 0, y: 0 };
      const rect = mapRef.current.getBoundingClientRect();
      const scale = Math.pow(2, zoom - DEFAULT_ZOOM);

      const x = rect.width / 2 + (lng - mapCenter.lng) * 800 * scale;
      const y = rect.height / 2 - (lat - mapCenter.lat) * 1100 * scale;

      return { x, y };
    },
    [mapCenter, zoom]
  );

  const handleZoomIn = () => setZoom((z) => Math.min(z + 1, 18));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 1, 8));

  const handleMapClick = () => {
    setSelectedDriver(null);
    setSelectedRide(null);
  };

  const filteredDrivers =
    filterStatus === 'all'
      ? drivers
      : drivers.filter((d) => d.status === filterStatus);

  const driversWithLocation = filteredDrivers.filter(
    (d) => d.location_lat !== null && d.location_lng !== null
  );

  const driverCounts = {
    all: drivers.length,
    available: drivers.filter((d) => d.status === 'available').length,
    busy: drivers.filter((d) => d.status === 'busy').length,
    on_trip: drivers.filter((d) => d.status === 'on_trip').length,
    offline: drivers.filter((d) => d.status === 'offline').length,
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FFFFFF] text-[#86868b]">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#86868b] border-t-[#0071e3]" />
          Loading map data...
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[#FFFFFF]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[#d2d2d7] bg-[#f5f5f7] px-5 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-[#1d1d1f]">Live Map</h1>
          <div className="flex items-center gap-2">
            {(['all', 'available', 'busy', 'on_trip', 'offline'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? 'bg-[#d2d2d7] text-[#1d1d1f]'
                    : 'text-[#86868b] hover:bg-[#d2d2d7]/50 hover:text-[#6e6e73]'
                }`}
              >
                {s !== 'all' && (
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[s] }}
                  />
                )}
                {s === 'all' ? 'All' : s.replace('_', ' ')}
                <span className="ml-1 text-[10px] text-[#86868b]">
                  {driverCounts[s]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#86868b]">
          <span>{driversWithLocation.length} on map</span>
          <span>{rides.length} active rides</span>
          {error && <span className="text-red-400">{error}</span>}
        </div>
      </div>

      {/* Map area */}
      <div
        ref={mapRef}
        className="relative flex-1 overflow-hidden bg-[#F9FAFB] cursor-grab"
        onClick={handleMapClick}
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #d2d2d7 1px, transparent 0)',
          backgroundSize: `${20 * Math.pow(2, zoom - DEFAULT_ZOOM)}px ${20 * Math.pow(2, zoom - DEFAULT_ZOOM)}px`,
        }}
      >
        {/* Grid lines for visual reference */}
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#d2d2d7]" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-[#d2d2d7]" />
        </div>

        {/* Ride markers — pickup (green) and dropoff (red) */}
        {rides.map((ride) => {
          if (!ride.pickup_lat || !ride.pickup_lng) return null;
          const pickup = latLngToPixel(ride.pickup_lat, ride.pickup_lng);
          const dropoff =
            ride.dropoff_lat && ride.dropoff_lng
              ? latLngToPixel(ride.dropoff_lat, ride.dropoff_lng)
              : null;

          return (
            <div key={`ride-${ride.id}`}>
              {/* Pickup marker */}
              <button
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                style={{ left: pickup.x, top: pickup.y }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRide(ride);
                  setSelectedDriver(null);
                }}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#0071e3] bg-emerald-400/30">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>
              </button>
              {/* Dropoff marker */}
              {dropoff && (
                <button
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                  style={{ left: dropoff.x, top: dropoff.y }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRide(ride);
                    setSelectedDriver(null);
                  }}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-red-400 bg-red-400/30">
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                  </div>
                </button>
              )}
              {/* Connection line */}
              {dropoff && (
                <svg
                  className="pointer-events-none absolute left-0 top-0 z-0"
                  style={{ width: '100%', height: '100%' }}
                >
                  <line
                    x1={pickup.x}
                    y1={pickup.y}
                    x2={dropoff.x}
                    y2={dropoff.y}
                    stroke="#86868b"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.5"
                  />
                </svg>
              )}
            </div>
          );
        })}

        {/* Driver markers */}
        {driversWithLocation.map((driver) => {
          const pos = latLngToPixel(driver.location_lat!, driver.location_lng!);
          const color = STATUS_COLORS[driver.status] ?? '#6b7280';
          const isSelected = selectedDriver?.id === driver.id;

          return (
            <button
              key={`driver-${driver.id}`}
              className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-125 ${
                isSelected ? 'scale-150 z-30' : ''
              }`}
              style={{ left: pos.x, top: pos.y }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDriver(driver);
                setSelectedRide(null);
              }}
            >
              <div
                className="flex h-4 w-4 items-center justify-center rounded-full shadow-lg"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 ${isSelected ? 12 : 6}px ${color}80`,
                }}
              >
                {isSelected && (
                  <div className="absolute h-8 w-8 animate-ping rounded-full opacity-20" style={{ backgroundColor: color }} />
                )}
              </div>
            </button>
          );
        })}

        {/* Zoom controls */}
        <div className="absolute right-4 top-4 z-40 flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#d2d2d7] transition-colors"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#d2d2d7] transition-colors"
          >
            -
          </button>
        </div>

        {/* Coordinate display */}
        <div className="absolute left-4 bottom-4 z-40 rounded-lg bg-[#f5f5f7]/90 border border-[#d2d2d7] px-3 py-1.5 text-[10px] font-mono text-[#86868b]">
          Center: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)} | Zoom: {zoom}
        </div>

        {/* Driver popup */}
        {selectedDriver && (
          <div
            className="absolute z-50 w-64 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7] p-4 shadow-2xl -translate-x-1/2"
            style={{
              left: latLngToPixel(selectedDriver.location_lat!, selectedDriver.location_lng!).x,
              top: latLngToPixel(selectedDriver.location_lat!, selectedDriver.location_lng!).y - 30,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[selectedDriver.status] }}
              />
              <span className="text-sm font-semibold text-[#1d1d1f]">
                {selectedDriver.full_name}
              </span>
            </div>
            <div className="space-y-1 text-xs text-[#6e6e73]">
              <div className="flex justify-between">
                <span>Status</span>
                <span className="font-medium capitalize text-[#1d1d1f]">
                  {selectedDriver.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Rating</span>
                <span className="text-[#1d1d1f]">
                  {selectedDriver.rating ? `${Number(selectedDriver.rating).toFixed(1)} / 5` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Trips</span>
                <span className="text-[#1d1d1f]">{selectedDriver.total_trips}</span>
              </div>
              {selectedDriver.vehicle && (
                <div className="flex justify-between">
                  <span>Vehicle</span>
                  <span className="text-[#1d1d1f]">
                    {selectedDriver.vehicle.color} {selectedDriver.vehicle.make}{' '}
                    {selectedDriver.vehicle.model}
                  </span>
                </div>
              )}
              {selectedDriver.vehicle && (
                <div className="flex justify-between">
                  <span>Plate</span>
                  <span className="font-mono text-[#1d1d1f]">
                    {selectedDriver.vehicle.plate_number}
                  </span>
                </div>
              )}
              {selectedDriver.speed_kmh != null && selectedDriver.speed_kmh > 0 && (
                <div className="flex justify-between">
                  <span>Speed</span>
                  <span className="text-[#1d1d1f]">{selectedDriver.speed_kmh} km/h</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ride popup */}
        {selectedRide && (
          <div
            className="absolute z-50 w-72 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7] p-4 shadow-2xl"
            style={{
              left: selectedRide.pickup_lat
                ? latLngToPixel(selectedRide.pickup_lat, selectedRide.pickup_lng!).x
                : '50%',
              top: selectedRide.pickup_lat
                ? latLngToPixel(selectedRide.pickup_lat, selectedRide.pickup_lng!).y - 30
                : '50%',
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={selectedRide.status} />
              <span className="text-[10px] font-mono text-[#86868b]">
                {selectedRide.id.slice(0, 8)}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-[#6e6e73]">
              <div>
                <span className="text-emerald-400 mr-1.5">P</span>
                {selectedRide.pickup_address?.slice(0, 40)}
              </div>
              <div>
                <span className="text-red-400 mr-1.5">D</span>
                {selectedRide.dropoff_address?.slice(0, 40)}
              </div>
              <div className="flex justify-between pt-1 border-t border-[#d2d2d7]">
                <span>Fare</span>
                <span className="text-[#1d1d1f] font-medium">
                  ${Number(selectedRide.final_fare ?? selectedRide.estimated_fare).toFixed(2)}
                </span>
              </div>
              {selectedRide.driver_name && (
                <div className="flex justify-between">
                  <span>Driver</span>
                  <span className="text-[#1d1d1f]">{selectedRide.driver_name}</span>
                </div>
              )}
              {selectedRide.rider_name && (
                <div className="flex justify-between">
                  <span>Rider</span>
                  <span className="text-[#1d1d1f]">{selectedRide.rider_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {driversWithLocation.length === 0 && rides.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-[#86868b]">
              <svg className="mx-auto mb-3 h-12 w-12 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm">No drivers or rides with location data</p>
              <p className="text-xs mt-1">Drivers appear when they share their location</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    searching_driver: 'bg-amber-500/20 text-amber-400',
    driver_assigned: 'bg-blue-500/20 text-blue-400',
    driver_arriving: 'bg-violet-500/20 text-violet-400',
    arrived: 'bg-indigo-500/20 text-indigo-400',
    in_progress: 'bg-emerald-500/20 text-emerald-400',
    completed: 'bg-[#0071e3]/10 text-[#0071e3]',
    cancelled: 'bg-red-500/20 text-red-400',
  };
  const cls = colors[status] ?? 'bg-zinc-500/20 text-[#86868b]';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
