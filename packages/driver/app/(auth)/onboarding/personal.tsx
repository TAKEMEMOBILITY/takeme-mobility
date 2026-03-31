import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

/**
 * Driver onboarding step 1: Personal information.
 * Phase 1: Form scaffold.
 * Phase 4: Validation, API submission, progress persistence.
 */
export default function PersonalInfoScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [license, setLicense] = useState('');

  const isValid = name.length > 1 && email.includes('@') && license.length > 4;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.step}>Step 1 of 3</Text>
        <Text style={styles.title}>Personal Information</Text>
        <Text style={styles.subtitle}>
          Tell us about yourself to get started driving with Takeme.
        </Text>

        <Input
          label="Full Name"
          placeholder="John Smith"
          value={name}
          onChangeText={setName}
          containerStyle={styles.field}
        />
        <Input
          label="Email"
          placeholder="john@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          containerStyle={styles.field}
        />
        <Input
          label="Driver's License Number"
          placeholder="WA-123456789"
          value={license}
          onChangeText={setLicense}
          containerStyle={styles.field}
        />
      </ScrollView>

      <View style={styles.bottom}>
        <Button
          title="Continue"
          onPress={() => router.push({
            pathname: '/(auth)/onboarding/vehicle',
            params: { fullName: name, email, licenseNumber: license },
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
