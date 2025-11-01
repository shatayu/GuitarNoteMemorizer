/**
 * Wake Lock API utility to prevent the device from sleeping
 * while the application is active.
 */

let wakeLock: WakeLockSentinel | null = null;

/**
 * Request a wake lock to prevent the device from sleeping.
 * Requires user interaction to activate.
 * 
 * @returns Promise that resolves when wake lock is acquired or rejects if unsupported/failed
 */
export async function requestWakeLock(): Promise<void> {
  // Check if Wake Lock API is supported
  if (!('wakeLock' in navigator)) {
    console.warn('Wake Lock API is not supported in this browser');
    return;
  }

  try {
    // Request wake lock
    wakeLock = await (navigator as any).wakeLock.request('screen');
    console.log('Wake lock acquired successfully');

    // Handle wake lock release (e.g., when tab becomes hidden)
    if (wakeLock !== null) {
      wakeLock.addEventListener('release', () => {
        console.log('Wake lock released');
      });
    }
  } catch (error) {
    // Wake lock request failed (might be due to lack of user interaction or unsupported)
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn('Wake lock request failed:', errorMsg);
  }
}

/**
 * Release the active wake lock.
 */
export async function releaseWakeLock(): Promise<void> {
  if (wakeLock !== null) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('Wake lock released successfully');
    } catch (error) {
      console.error('Failed to release wake lock:', error);
    }
  }
}

/**
 * Check if wake lock is currently active.
 */
export function isWakeLockActive(): boolean {
  return wakeLock !== null;
}

