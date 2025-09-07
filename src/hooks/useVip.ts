"use client";

import { useState, useEffect } from 'react';


export function useVip() {
  const session = { user: { name: "Guest" } };
  const [isVip, setIsVip] = useState(false);
  const [vipStatus, setVipStatus] = useState<{
    level: 'guest' | 'basic' | 'premium';
    expiresAt?: Date;
    features?: string[];
  }>({
    level: 'guest'
  });

  useEffect(() => {
    let isMounted = true;
    
    // Check FREE_FOR_ALL mode
    if (process.env.NEXT_PUBLIC_FREE_ALL === 'true') {
      if (isMounted) {
        setIsVip(true);
        setVipStatus({
          level: 'premium',
          features: ['unlimited_messages', 'hd_video', 'filters', 'ar_masks']
        });
      }
      return;
    }

    // Simple anonymous check - no need for session dependency
    const checkVipStatus = async () => {
      try {
        const response = await fetch('/api/user/vip-status', {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        if (!response.ok) throw new Error('VIP status check failed');
        const data = await response.json();
        if (isMounted) {
          setIsVip(data.isVip || false);
          setVipStatus(data.status || { level: 'guest' });
        }
      } catch (error) {
        console.error('Failed to check VIP status:', error);
        if (isMounted) {
          setIsVip(false);
          setVipStatus({ level: 'guest' });
        }
      }
    };
    
    // Only check once per component mount
    checkVipStatus();
    
    return () => {
      isMounted = false;
    };
  }, []); // Remove session dependency to prevent excessive calls

  return {
    isVip,
    vipStatus,
    isLoading: false,
    error: null
  };
}
