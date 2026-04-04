import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Ride' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopColor: colors.borderLight,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 88, paddingBottom: 24, paddingTop: 8,
  },
  label: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
});
