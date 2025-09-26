"use client";

interface ViewportState {
  height: number;
  width: number;
  isKeyboardOpen: boolean;
  originalHeight: number;
}

class MobileOptimizer {
  private viewport: ViewportState = {
    height: 0,
    width: 0,
    isKeyboardOpen: false,
    originalHeight: 0
  };
  
  private callbacks: Set<(state: ViewportState) => void> = new Set();
  private resizeObserver: ResizeObserver | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    // Set initial viewport state
    this.updateViewport();
    this.viewport.originalHeight = this.viewport.height;

    // Listen for visual viewport changes (keyboard open/close)
    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', this.handleViewportChange);
      window.visualViewport?.addEventListener('scroll', this.handleViewportChange);
    }

    // Fallback for older browsers
    window.addEventListener('resize', this.handleWindowResize);

    // Observe document resize
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(this.handleDocumentResize);
      this.resizeObserver.observe(document.documentElement);
    }

    // Prevent zoom on input focus (iOS Safari)
    this.preventZoomOnFocus();
  }

  private updateViewport() {
    if (typeof window === 'undefined') return;

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      this.viewport = {
        height: visualViewport.height,
        width: visualViewport.width,
        isKeyboardOpen: visualViewport.height < this.viewport.originalHeight * 0.8,
        originalHeight: this.viewport.originalHeight || visualViewport.height
      };
    } else {
      // Fallback
      this.viewport = {
        height: window.innerHeight,
        width: window.innerWidth,
        isKeyboardOpen: window.innerHeight < this.viewport.originalHeight * 0.8,
        originalHeight: this.viewport.originalHeight || window.innerHeight
      };
    }
  }

  private handleViewportChange = () => {
    this.updateViewport();
    this.notifyCallbacks();
    this.adjustForKeyboard();
  };

  private handleWindowResize = () => {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.updateViewport();
      this.notifyCallbacks();
    }, 100);
  };

  private handleDocumentResize = () => {
    this.updateViewport();
    this.notifyCallbacks();
  };

  private notifyCallbacks() {
    this.callbacks.forEach(callback => {
      try {
        callback(this.viewport);
      } catch (error) {
        console.warn('Viewport callback error:', error);
      }
    });
  }

  private adjustForKeyboard() {
    const chatContainer = document.querySelector('[data-chat-container]') as HTMLElement;
    const toolbar = document.querySelector('[data-toolbar]') as HTMLElement;
    
    if (this.viewport.isKeyboardOpen) {
      // Keyboard is open
      if (chatContainer) {
        chatContainer.style.height = `${this.viewport.height}px`;
        chatContainer.style.paddingBottom = '0px';
      }
      
      if (toolbar) {
        toolbar.style.position = 'fixed';
        toolbar.style.bottom = '0px';
        toolbar.style.transform = 'none';
      }
      
      // Scroll active input into view
      const activeInput = document.activeElement as HTMLElement;
      if (activeInput && (activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          activeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    } else {
      // Keyboard is closed
      if (chatContainer) {
        chatContainer.style.height = '';
        chatContainer.style.paddingBottom = '';
      }
      
      if (toolbar) {
        toolbar.style.position = '';
        toolbar.style.bottom = '';
        toolbar.style.transform = '';
      }
    }
  }

  private preventZoomOnFocus() {
    // Add viewport meta tag to prevent zoom
    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.appendChild(viewportMeta);
    }
    
    const originalContent = viewportMeta.content;
    
    // Prevent zoom on input focus
    document.addEventListener('focusin', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      }
    });
    
    // Restore zoom capability on blur
    document.addEventListener('focusout', () => {
      setTimeout(() => {
        viewportMeta.content = originalContent || 'width=device-width, initial-scale=1.0';
      }, 100);
    });
  }

  public subscribe(callback: (state: ViewportState) => void): () => void {
    this.callbacks.add(callback);
    
    // Immediately call with current state
    callback(this.viewport);
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public getViewportState(): ViewportState {
    return { ...this.viewport };
  }

  public setKeyboardPadding(element: HTMLElement, enabled: boolean = true) {
    if (enabled && this.viewport.isKeyboardOpen) {
      const padding = Math.max(0, this.viewport.originalHeight - this.viewport.height);
      element.style.paddingBottom = `${padding}px`;
    } else {
      element.style.paddingBottom = '';
    }
  }

  public destroy() {
    if (typeof window !== 'undefined') {
      window.visualViewport?.removeEventListener('resize', this.handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', this.handleViewportChange);
      window.removeEventListener('resize', this.handleWindowResize);
      
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
      
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
    }
    
    this.callbacks.clear();
  }
}

// Singleton instance
let mobileOptimizerInstance: MobileOptimizer | null = null;

export const getMobileOptimizer = (): MobileOptimizer => {
  if (!mobileOptimizerInstance) {
    mobileOptimizerInstance = new MobileOptimizer();
  }
  return mobileOptimizerInstance;
};

export type { ViewportState };
export default MobileOptimizer;