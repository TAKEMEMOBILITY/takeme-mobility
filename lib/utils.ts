import { RideType } from '@/types';

export function calculateFare(rideType: RideType, distance: number, time: number): number {
  const fare = rideType.basePrice + distance * rideType.perMilePrice + time * rideType.perMinutePrice;
  return Math.max(fare, rideType.minFare);
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  task: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= maxAttempts) break;
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      await sleep(backoff);
    }
  }

  throw lastError;
}

export async function fetchWithRetry(
  input: RequestInfo,
  init?: RequestInit,
  timeoutMs = 10000,
  maxAttempts = 3
): Promise<Response> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (!response.ok) {
        // Try to read body safely.
        const text = await response.text().catch(() => 'no body');
        throw new Error(`Network response failed with status ${response.status}: ${text}`);
      }
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }, maxAttempts);
}

