export function isBrowser() {
  return typeof window !== 'undefined';
}

export function lsGet<T>(key: string, def: T): T {
  if (!isBrowser()) {
    return def;
  }
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : def;
  } catch {
    return def;
  }
}

export function lsSet(key: string, value: any): void {
  if (!isBrowser()) {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to set localStorage item '${key}':`, error);
  }
}

export function safeJsonParse<T>(str: string | null): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}