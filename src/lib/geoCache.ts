"use client";

import safeFetch from '@/app/chat/safeFetch';

// Geo cache utility for fast meta info delivery
export interface GeoData {
  country: string | null;
  city: string | null;
  region: string | null;
  lat: string | null;
  lon: string | null;
  ip: string | null;
  src: string;
  timestamp: number;
}

const GEO_CACHE_KEY = 'ditona.geo.cache';
const GEO_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Get cached geo data if valid
export function getCachedGeo(): GeoData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    if (!cached) return null;
    
    const data: GeoData = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - data.timestamp > GEO_CACHE_TTL) {
      localStorage.removeItem(GEO_CACHE_KEY);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

// Set geo data in cache
export function setCachedGeo(data: Omit<GeoData, 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheData: GeoData = {
      ...data,
      timestamp: Date.now()
    };
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Failed to cache, continue without caching
  }
}

// Fetch fresh geo data with caching
export async function fetchGeoWithCache(): Promise<GeoData> {
  try {
    const response = await safeFetch('/api/geo', { 
      timeoutMs: 5000 // 5 second timeout
    });
    
    if (response.ok) {
      const geo = await response.json();
      const geoData: Omit<GeoData, 'timestamp'> = {
        country: geo.country || null,
        city: geo.city || null,
        region: geo.region || null,
        lat: geo.lat || null,
        lon: geo.lon || null,
        ip: geo.ip || null,
        src: geo.src || 'api'
      };
      
      // Cache the fresh data
      setCachedGeo(geoData);
      
      return {
        ...geoData,
        timestamp: Date.now()
      };
    }
  } catch (error) {
    console.warn('[geo-cache] Failed to fetch geo data:', error);
  }
  
  // Return fallback data
  return {
    country: null,
    city: null,
    region: null,
    lat: null,
    lon: null,
    ip: null,
    src: 'fallback',
    timestamp: Date.now()
  };
}

// Get geo data immediately (cached) or with fallback
export function getImmediateGeo(): { country: string; city: string } {
  const cached = getCachedGeo();
  
  if (cached) {
    return {
      country: cached.country || 'Unknown',
      city: cached.city || 'Unknown'
    };
  }
  
  // Fallback values for immediate use
  return {
    country: 'Unknown',
    city: 'Unknown'
  };
}

// Prefetch geo data in background (fire and forget)
export function prefetchGeo(): void {
  if (typeof window === 'undefined') return;
  
  // Check if we already have recent cached data
  const cached = getCachedGeo();
  if (cached) return; // No need to prefetch if we have valid cache
  
  // Fetch in background without blocking
  fetchGeoWithCache().catch(() => {
    // Silent fail for prefetch
  });
}