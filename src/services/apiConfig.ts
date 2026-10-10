/**
 * Centralized API Base configuration
 * Ensures requests from Capacitor Android APK, local dev, or web always hit the active backend.
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') return 'https://chill-reader.vercel.app';

  // 1. Check if running inside Capacitor Native Mobile App (Android/iOS)
  const isCapacitor = Boolean(
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:'
  );

  // 2. Check if running on localhost dev server
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // 3. Check if deployed on official Vercel domain
  const isVercel = window.location.origin.includes('vercel.app');

  // If mobile native, local dev, or external host -> Route to production Vercel API
  if (isCapacitor || isLocal || !isVercel) {
    return 'https://chill-reader.vercel.app';
  }

  // If running directly on Vercel web, use relative path
  return '';
}
