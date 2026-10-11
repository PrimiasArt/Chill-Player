type ShakeListener = () => void;

class ShakeDetector {
  private lastX: number | null = null;
  private lastY: number | null = null;
  private lastZ: number | null = null;
  private lastShakeTime = 0;
  private threshold = 16; // acceleration threshold in m/s^2
  private listeners: Set<ShakeListener> = new Set();
  private isListening = false;

  private handleMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const curTime = Date.now();
    if (curTime - this.lastShakeTime < 1800) return; // Debounce 1.8s

    if (this.lastX !== null && this.lastY !== null && this.lastZ !== null) {
      const deltaX = Math.abs(acc.x - this.lastX);
      const deltaY = Math.abs(acc.y - this.lastY);
      const deltaZ = Math.abs(acc.z - this.lastZ);

      const change = deltaX + deltaY + deltaZ;
      if (change > this.threshold) {
        this.lastShakeTime = curTime;
        this.triggerShake();
      }
    }

    this.lastX = acc.x;
    this.lastY = acc.y;
    this.lastZ = acc.z;
  };

  private triggerShake() {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 60, 120]);
      }
    } catch {}

    this.listeners.forEach(l => l());
  }

  public start() {
    if (this.isListening || typeof window === 'undefined') return;
    try {
      if ('DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', this.handleMotion, { passive: true });
        this.isListening = true;
      }
    } catch (e) {
      console.warn('Device motion listener error:', e);
    }
  }

  public stop() {
    if (!this.isListening || typeof window === 'undefined') return;
    try {
      window.removeEventListener('devicemotion', this.handleMotion);
    } catch {}
    this.isListening = false;
    this.lastX = null;
    this.lastY = null;
    this.lastZ = null;
  }

  public addListener(listener: ShakeListener) {
    this.listeners.add(listener);
    this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }
}

export const shakeDetector = new ShakeDetector();
