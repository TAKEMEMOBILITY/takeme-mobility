'use client';

import { useState } from 'react';
import { Autocomplete } from '@react-google-maps/api';
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
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place && place.formatted_address) {
        onChange(place.formatted_address);
        onPlaceSelect(place);
      }
    }
  };

  const dotColor = icon === 'pickup' ? 'bg-success' : 'bg-danger';

  const inputEl = (
    <div className="group flex items-center gap-3 rounded-xl bg-surface-secondary px-4 py-3.5 transition-colors duration-150 focus-within:bg-surface-tertiary focus-within:ring-1 focus-within:ring-ink/10">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[15px] font-medium text-ink placeholder-ink-tertiary focus:outline-none"
      />
    </div>
  );

  if (!isLoaded) return inputEl;

  return (
    <Autocomplete
      onLoad={setAutocomplete}
      onPlaceChanged={onPlaceChanged}
      options={{
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry', 'place_id'],
      }}
    >
      {inputEl}
    </Autocomplete>
  );
}
