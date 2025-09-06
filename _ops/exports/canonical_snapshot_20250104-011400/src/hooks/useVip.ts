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
    // Check FREE_FOR_ALL mode
    if (process.env.NEXT_PUBLIC_FREE_ALL === 'true') {
      setIsVip(true);
      setVipStatus({
        level: 'premium',
        features: ['unlimited_messages', 'hd_video', 'filters', 'ar_masks']
      });
      return;
    }

    // Check session for VIP status
    if (session?.user) {
      const checkVipStatus = async () => {
        try {
          const response = await fetch('/api/user/vip-status');
          const data = await response.json();
          setIsVip(data.isVip || false);
          setVipStatus(data.status || { level: 'guest' });
        } catch (error) {
          console.error('Failed to check VIP status:', error);
        }
      };
      checkVipStatus();
    }
  }, [session]);

  return {
    isVip,
    vipStatus,
    isLoading: false,
    error: null
  };
}
