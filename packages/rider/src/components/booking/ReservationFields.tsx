import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';

export type ScheduleMode = 'now' | 'scheduled';

interface Props {
  mode: ScheduleMode;
  onModeChange: (m: ScheduleMode) => void;
  date: Date;
  onDateChange: (d: Date) => void;
  time: Date;
  onTimeChange: (t: Date) => void;
}

function formatDate(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function ReservationFields({
  mode, onModeChange,
  date, onDateChange,
  time, onTimeChange,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Now / Scheduled toggle */}
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode === 'now' && styles.modeBtnActive]}
          onPress={() => onModeChange('now')}
        >
          <Text style={[styles.modeText, mode === 'now' && styles.modeTextActive]}>Now</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'scheduled' && styles.modeBtnActive]}
          onPress={() => onModeChange('scheduled')}
        >
          <Text style={[styles.modeText, mode === 'scheduled' && styles.modeTextActive]}>
            Schedule
          </Text>
        </Pressable>
      </View>

      {/* Date / Time pickers — shown when scheduled */}
      {mode === 'scheduled' && (
        <View style={styles.pickerRow}>
          <Pressable style={styles.pickerCell}>
            <Text style={styles.pickerIcon}>{'\u2630'}</Text>
            <Text style={styles.pickerValue}>{formatDate(date)}</Text>
          </Pressable>
          <Pressable style={styles.pickerCell}>
            <Text style={styles.pickerIcon}>{'\u25F7'}</Text>
            <Text style={styles.pickerValue}>{formatTime(time)}</Text>
          </Pressable>
        </View>
      )}

      {/* Now indicator */}
      {mode === 'now' && (
        <View style={styles.nowRow}>
          <View style={styles.nowDot} />
          <Text style={styles.nowText}>Pickup as soon as possible</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },

  // Mode toggle
  modeRow: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#fff',
  },
  modeBtnActive: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  modeText: { fontSize: 14, fontWeight: '500', color: '#A0A0A0' },
  modeTextActive: { color: '#fff' },

  // Date / time
  pickerRow: { flexDirection: 'row', gap: 8 },
  pickerCell: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff',
  },
  pickerIcon: { fontSize: 14, color: '#A0A0A0' },
  pickerValue: { fontSize: 14, fontWeight: '500', color: '#000' },

  // Now
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  nowText: { fontSize: 13, color: '#666', fontWeight: '400' },
});
