import { z } from 'zod';

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(1),
});

export type Location = z.infer<typeof locationSchema>;

export const routeSchema = z.object({
  distance: z.number().positive(),
  duration: z.number().positive(),
  polyline: z.string().optional(),
});

export type Route = z.infer<typeof routeSchema>;

export const rideStatusSchema = z.enum(['pending', 'confirmed', 'completed', 'cancelled']);

export const rideSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  pickup_location: locationSchema,
  dropoff_location: locationSchema,
  ride_type: z.enum(['economy', 'comfort', 'premium']),
  estimated_fare: z.number().nonnegative(),
  estimated_time: z.number().nonnegative(), // minutes
  status: rideStatusSchema,
  created_at: z.string(),
  updated_at: z.string().optional(),
});

export type Ride = z.infer<typeof rideSchema>;

export const rideOptionSchema = z.object({
  id: z.union([z.literal('economy'), z.literal('comfort'), z.literal('premium')]),
  name: z.string(),
  description: z.string(),
  estimatedPrice: z.number(),
  estimatedTime: z.number(),
  icon: z.string().optional(),
});

export type RideOption = z.infer<typeof rideOptionSchema>;

export const rideTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  basePrice: z.number(),
  perMilePrice: z.number(),
  perMinutePrice: z.number(),
  minFare: z.number(),
});

export type RideType = z.infer<typeof rideTypeSchema>;

export interface RidesDatabase {
  rides: Ride;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  rating: number;
  totalRides: number;
}

