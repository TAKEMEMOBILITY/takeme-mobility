import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function VehicleInfoScreen() {
  const router = useRouter();
  const personalParams = useLocalSearchParams();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');

  const isValid =
    make.length > 1 &&
    model.length > 1 &&
    year.length === 4 &&
    color.length > 1 &&
    plate.length > 2;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.step}>Step 2 of 3</Text>
        <Text style={styles.title}>Vehicle Information</Text>
        <Text style={styles.subtitle}>
          Add your vehicle details. Electric vehicles are preferred.
        </Text>

        <Input label="Make" placeholder="Tesla" value={make} onChangeText={setMake} containerStyle={styles.field} />
        <Input label="Model" placeholder="Model 3" value={model} onChangeText={setModel} containerStyle={styles.field} />
        <Input label="Year" placeholder="2024" keyboardType="number-pad" maxLength={4} value={year} onChangeText={setYear} containerStyle={styles.field} />
        <Input label="Color" placeholder="White" value={color} onChangeText={setColor} containerStyle={styles.field} />
        <Input label="License Plate" placeholder="ABC 1234" autoCapitalize="characters" value={plate} onChangeText={setPlate} containerStyle={styles.field} />
      </ScrollView>

      <View style={styles.bottom}>
        <Button
          title="Continue"
          onPress={() => router.push({
            pathname: '/(auth)/onboarding/documents',
            params: {
              ...personalParams,
              vehicleMake: make,
              vehicleModel: model,
              vehicleYear: year,
              vehicleColor: color,
              plateNumber: plate,
            },
          })}
          size="lg"
          fullWidth
          disabled={!isValid}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing['2xl'], paddingTop: spacing['3xl'] },
  step: { ...typography.captionBold, color: colors.accent, marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing['3xl'] },
  field: { marginBottom: spacing.xl },
  bottom: { padding: spacing['2xl'] },
});
