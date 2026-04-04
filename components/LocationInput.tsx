'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';

interface LocationInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  icon?: 'pickup' | 'dropoff';
}

export default function LocationInput({ placeholder, value, onChange, onPlaceSelect, icon = 'pickup' }: LocationInputProps) {
  const { isLoaded } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const initializedRef = useRef(false);

  const dotColor = icon === 'pickup' ? 'bg-[#1D6AE5]' : 'bg-[#1d1d1f]';

  // Initialize Google Places Autocomplete once when API is ready
  const initAutocomplete = useCallback(() => {
    if (initializedRef.current || !inputRef.current) return;
    if (typeof google === 'undefined' || !google.maps?.places?.Autocomplete) return;

    try {
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry', 'place_id'],
      });

      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place && place.formatted_address) {
          onChange(place.formatted_address);
          onPlaceSelect(place);
        }
      });

      autocompleteRef.current = ac;
      initializedRef.current = true;
    } catch (err) {
      console.error('[LocationInput] Autocomplete init failed:', err);
    }
  }, [onChange, onPlaceSelect]);

  useEffect(() => {
    if (isLoaded) {
      initAutocomplete();
    }
  }, [isLoaded, initAutocomplete]);

  return (
    <div className="group flex items-center gap-3 rounded-xl bg-[#f5f5f7] px-4 py-3.5 transition-colors duration-150 focus-within:bg-[#e8e8ed] focus-within:ring-1 focus-within:ring-[#1d1d1f]/10">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[15px] font-medium text-[#1d1d1f] placeholder-[#86868b] outline-none"
      />
    </div>
  );
}
