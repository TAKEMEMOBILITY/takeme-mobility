import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';

export type RideFor = 'me' | 'someone' | 'vip';

interface Props {
  value: RideFor;
  onChange: (v: RideFor) => void;
  passengerName: string;
  onPassengerNameChange: (v: string) => void;
  passengerPhone: string;
  onPassengerPhoneChange: (v: string) => void;
  driverNotes: string;
  onDriverNotesChange: (v: string) => void;
  meetGreet: boolean;
  onMeetGreetChange: (v: boolean) => void;
  nameSign: boolean;
  onNameSignChange: (v: boolean) => void;
}

const OPTIONS: { id: RideFor; label: string }[] = [
  { id: 'me', label: 'For me' },
  { id: 'someone', label: 'Someone else' },
  { id: 'vip', label: 'VIP guest' },
];

export function RiderTypeSelector({
  value, onChange,
  passengerName, onPassengerNameChange,
  passengerPhone, onPassengerPhoneChange,
  driverNotes, onDriverNotesChange,
  meetGreet, onMeetGreetChange,
  nameSign, onNameSignChange,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Segmented control */}
      <View style={styles.segmented}>
        {OPTIONS.map((opt, i) => {
          const active = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={[
                styles.segment,
                i > 0 && styles.segmentBorder,
                active && styles.segmentActive,
              ]}
              onPress={() => onChange(opt.id)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Someone else fields */}
      {value === 'someone' && (
        <View style={styles.fields}>
          <TextInput
            style={styles.input}
            placeholder="Passenger name"
            placeholderTextColor="#A0A0A0"
            value={passengerName}
            onChangeText={onPassengerNameChange}
          />
          <TextInput
            style={styles.input}
            placeholder="Passenger phone"
            placeholderTextColor="#A0A0A0"
            keyboardType="phone-pad"
            value={passengerPhone}
            onChangeText={onPassengerPhoneChange}
          />
        </View>
      )}

      {/* VIP guest fields */}
      {value === 'vip' && (
        <View style={styles.fields}>
          <TextInput
            style={styles.input}
            placeholder="Guest name"
            placeholderTextColor="#A0A0A0"
            value={passengerName}
            onChangeText={onPassengerNameChange}
          />
          <TextInput
            style={styles.input}
            placeholder="Guest phone"
            placeholderTextColor="#A0A0A0"
            keyboardType="phone-pad"
            value={passengerPhone}
            onChangeText={onPassengerPhoneChange}
          />
          <TextInput
            style={styles.input}
            placeholder="Notes for driver (optional)"
            placeholderTextColor="#A0A0A0"
            value={driverNotes}
            onChangeText={onDriverNotesChange}
          />

          <View style={styles.toggleRow}>
            <ToggleChip
              label="Meet & greet"
              active={meetGreet}
              onToggle={() => onMeetGreetChange(!meetGreet)}
            />
            <ToggleChip
              label="Name sign"
              active={nameSign}
              onToggle={() => onNameSignChange(!nameSign)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function ToggleChip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onToggle}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },

  // Segmented
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  segmentBorder: { borderLeftWidth: 1, borderLeftColor: '#E5E5E5' },
  segmentActive: { backgroundColor: '#0A0A0A' },
  segmentText: { fontSize: 13, fontWeight: '500', color: '#A0A0A0' },
  segmentTextActive: { color: '#fff' },

  // Fields
  fields: { marginTop: 12, gap: 8 },
  input: {
    fontSize: 14, fontWeight: '500', color: '#000',
    borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff',
  },

  // Toggle chips
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  chipActive: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  chipText: { fontSize: 12, fontWeight: '500', color: '#A0A0A0' },
  chipTextActive: { color: '#fff' },
});
