import { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';

type BackHandler = () => boolean | void;

class BackButtonService {
  private handlers: BackHandler[] = [];
  private isInitialized = false;

  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen to Capacitor native hardware back button event on Android
    CapApp.addListener('backButton', () => {
      this.handleBack(true);
    }).catch((err) => {
      console.warn('Capacitor App backButton listener registration error:', err);
    });

    // Also support keyboard Escape key in web browser testing/preview
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleBack(false);
      }
    });
  }

  public handleBack(allowExitApp = true): boolean {
    // Pop and invoke the top handler from the stack
    while (this.handlers.length > 0) {
      const topHandler = this.handlers[this.handlers.length - 1];
      const result = topHandler();
      // If the handler returned false, continue to next handler in stack,
      // otherwise it successfully handled the back action.
      if (result !== false) {
        return true;
      }
      // If returned false, remove it and try next
      this.handlers.pop();
    }

    // No handlers left to consume back action
    if (allowExitApp) {
      CapApp.exitApp().catch(() => {});
    }
    return false;
  }

  public pushHandler(handler: BackHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.lastIndexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  public getStackDepth(): number {
    return this.handlers.length;
  }
}

export const backButtonService = new BackButtonService();

/**
 * React hook to register a back button handler.
 * Automatically cleans up on unmount or when enabled becomes false.
 */
export function useBackButton(handler: BackHandler, enabled: boolean = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    // Stable wrapper that calls the latest closure
    const stableHandler = () => handlerRef.current();
    const unregister = backButtonService.pushHandler(stableHandler);

    return () => {
      unregister();
    };
  }, [enabled]);
}
