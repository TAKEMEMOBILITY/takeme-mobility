import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';

const AIRLINES = [
  'Alaska Airlines', 'Delta Air Lines', 'United Airlines', 'American Airlines',
  'Southwest Airlines', 'JetBlue Airways', 'Spirit Airlines', 'Frontier Airlines',
  'Hawaiian Airlines', 'Sun Country Airlines', 'Allegiant Air',
  'Air Canada', 'British Airways', 'Lufthansa', 'Emirates',
  'Korean Air', 'Japan Airlines', 'ANA', 'Cathay Pacific',
  'Singapore Airlines', 'Icelandair', 'Condor', 'Other',
];

interface Props {
  airline: string;
  onAirlineChange: (v: string) => void;
  flightNumber: string;
  onFlightNumberChange: (v: string) => void;
}

export function AirportRideSection({
  airline, onAirlineChange,
  flightNumber, onFlightNumberChange,
}: Props) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{'\u2708'}</Text>
        <Text style={styles.headerLabel}>Airport ride</Text>
      </View>

      {/* Fields */}
      <View style={styles.body}>
        {/* Airline selector */}
        <Pressable style={styles.select} onPress={() => setShowPicker(true)}>
          <Text style={[styles.selectText, !airline && styles.selectPlaceholder]}>
            {airline || 'Select airline'}
          </Text>
          <Text style={styles.selectChevron}>{'\u2304'}</Text>
        </Pressable>

        {/* Flight number */}
        <TextInput
          style={styles.input}
          placeholder="Flight number (optional)"
          placeholderTextColor="#A0A0A0"
          value={flightNumber}
          onChangeText={(t) => onFlightNumberChange(t.toUpperCase())}
          maxLength={10}
          autoCapitalize="characters"
        />
      </View>

      {/* Airline picker modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Select airline</Text>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {AIRLINES.map((a) => (
                <Pressable
                  key={a}
                  style={[styles.pickerRow, airline === a && styles.pickerRowActive]}
                  onPress={() => { onAirlineChange(a); setShowPicker(false); }}
                >
                  <Text style={[styles.pickerRowText, airline === a && styles.pickerRowTextActive]}>
                    {a}
                  </Text>
                  {airline === a && <Text style={styles.pickerCheck}>{'\u2713'}</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
    marginBottom: 20,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  headerIcon: { fontSize: 14, color: '#000', marginRight: 8 },
  headerLabel: { fontSize: 12, fontWeight: '600', color: '#000', letterSpacing: 0.3 },

  // Body
  body: { padding: 12, gap: 8 },

  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff',
  },
  selectText: { fontSize: 14, fontWeight: '500', color: '#000' },
  selectPlaceholder: { color: '#A0A0A0' },
  selectChevron: { fontSize: 16, color: '#A0A0A0' },

  input: {
    fontSize: 14, fontWeight: '500', color: '#000',
    borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff',
  },

  // Picker modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 40,
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#D4D4D4', alignSelf: 'center',
    marginTop: 10, marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 16, fontWeight: '600', color: '#000',
    paddingHorizontal: 24, marginBottom: 12,
  },
  pickerList: { paddingHorizontal: 16 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  pickerRowActive: { backgroundColor: '#F8F8F8' },
  pickerRowText: { fontSize: 15, color: '#000' },
  pickerRowTextActive: { fontWeight: '600' },
  pickerCheck: { fontSize: 16, fontWeight: '600', color: '#000' },
});
