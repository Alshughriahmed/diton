"use client";

import { useState, useEffect } from 'react';

interface PeerHeaderProps {
  peer?: {
    id?: string;
    name?: string;
    country?: string;
    city?: string;
    gender?: string;
    isVip?: boolean;
  } | null;
}

export default function PeerHeader({ peer }: PeerHeaderProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    if (peer) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('connecting');
    }
  }, [peer]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getGenderEmoji = (gender?: string) => {
    switch (gender) {
      case 'male':
        return '♂️';
      case 'female':
        return '♀️';
      case 'couple':
        return '💑';
      case 'lgbt':
        return '🏳️‍🌈';
      default:
        return '👤';
    }
  };

  return (
    <div className="bg-gray-800 px-4 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        {/* Connection Status */}
        <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
        
        {/* Peer Info */}
        <div className="flex items-center gap-2">
          {peer ? (
            <>
              <span className="text-white font-medium">
                {peer.name || `User ${peer.id?.slice(0, 8)}`}
              </span>
              {peer.gender && (
                <span className="text-lg">{getGenderEmoji(peer.gender)}</span>
              )}
              {peer.country && (
                <span className="text-gray-300 text-sm">
                  📍 {peer.city && `${peer.city}, `}{peer.country}
                </span>
              )}
              {peer.isVip && (
                <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black px-2 py-0.5 rounded text-xs font-bold">
                  VIP
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-400">Connecting...</span>
          )}
        </div>
      </div>

      {/* Connection Time */}
      <div className="text-gray-400 text-sm">
        {connectionStatus === 'connected' && '00:00'}
      </div>
    </div>
  );
}
