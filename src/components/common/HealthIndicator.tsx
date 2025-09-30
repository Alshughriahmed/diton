"use client";
import safeFetch from '@/app/chat/safeFetch';

import { useState, useEffect } from 'react';

export default function HealthIndicator() {
  const [health, setHealth] = useState<'healthy' | 'degraded' | 'error'>('healthy');
  const [details, setDetails] = useState({
    api: true,
    database: true,
    webrtc: true,
    stripe: true
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await safeFetch('/api/_health');
        const data = await response.json();
        
        setDetails(data.services || details);
        
        if (data.status === 'ok') {
          setHealth('healthy');
        } else if (data.status === 'degraded') {
          setHealth('degraded');
        } else {
          setHealth('error');
        }
      } catch (error) {
        setHealth('error');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getHealthColor = () => {
    switch (health) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
    }
  };

  const getHealthEmoji = () => {
    switch (health) {
      case 'healthy':
        return '✅';
      case 'degraded':
        return '⚠️';
      case 'error':
        return '❌';
    }
  };

  return (
    <div className="relative group">
      <div className={`w-3 h-3 rounded-full ${getHealthColor()} animate-pulse cursor-pointer`} />
      
      {/* Tooltip */}
      <div className="absolute right-0 top-5 bg-gray-800 text-white p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none min-w-[180px]">
        <div className="text-sm font-bold mb-2">System Health {getHealthEmoji()}</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>API:</span>
            <span>{details.api ? '✅' : '❌'}</span>
          </div>
          <div className="flex justify-between">
            <span>Database:</span>
            <span>{details.database ? '✅' : '❌'}</span>
          </div>
          <div className="flex justify-between">
            <span>WebRTC:</span>
            <span>{details.webrtc ? '✅' : '❌'}</span>
          </div>
          <div className="flex justify-between">
            <span>Payments:</span>
            <span>{details.stripe ? '✅' : '❌'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
