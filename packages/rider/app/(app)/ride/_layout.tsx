import React from 'react';
import { Stack } from 'expo-router';

export default function RideFlowLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="destination" />
      <Stack.Screen name="quotes" />
      <Stack.Screen name="searching" />
      <Stack.Screen name="assigned" />
      <Stack.Screen name="tracking" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
