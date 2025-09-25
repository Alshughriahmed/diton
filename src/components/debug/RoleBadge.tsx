"use client";

import { useState, useEffect } from 'react';


export default function RoleBadge() {
  const session = { user: { name: "Guest", role: "user" } };
  const [role, setRole] = useState<'guest' | 'user' | 'vip' | 'admin'>('guest');
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Check for debug mode
    const isDebugMode = process.env.NODE_ENV === 'development' || 
    (typeof window!=='undefined') && (globalThis as any).__vip && ((((globalThis as any).__vip).DEBUG===true) || (((globalThis as any).__vip).DEBUG==='true'))                   
    setShowDebug(isDebugMode);

    // Determine role
    if (session?.user) {
      // Check for admin
      if ((session.user as any).role === 'admin') {
        setRole('admin');
      } else if ((session.user as any).isVip) {
        setRole('vip');
      } else {
        setRole('user');
      }
    }
  }, [session]);

  if (!showDebug) return null;

  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return { bg: 'bg-red-600', text: 'ADMIN', icon: '👑' };
      case 'vip':
        return { bg: 'bg-gradient-to-r from-yellow-400 to-amber-500', text: 'VIP', icon: '⭐' };
      case 'user':
        return { bg: 'bg-blue-600', text: 'USER', icon: '👤' };
      default:
        return { bg: 'bg-gray-600', text: 'GUEST', icon: '👻' };
    }
  };

  const badge = getRoleBadge();

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`${badge.bg} text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg`}>
        <span>{badge.icon}</span>
        <span>{badge.text}</span>
        {process.env.NODE_ENV === 'development' && (
          <span className="ml-2 opacity-75">DEV</span>
        )}
      </div>
    </div>
  );
}
