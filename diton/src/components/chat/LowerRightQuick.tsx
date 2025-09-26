"use client";

import { useState } from 'react';

export default function LowerRightQuick() {
  const [isExpanded, setIsExpanded] = useState(false);

  const quickActions = [
    { id: 'report', icon: '🚫', label: 'Report User', action: 'report' },
    { id: 'skip', icon: '⏭️', label: 'Skip', action: 'skip' },
    { id: 'filter', icon: '🎯', label: 'Filter', action: 'filter' },
    { id: 'settings', icon: '⚙️', label: 'Settings', action: 'settings' }
  ];

  const handleAction = (action: string) => {
    console.log('Quick action:', action);
    window.dispatchEvent(new CustomEvent('quick:action', { detail: { action } }));
    setIsExpanded(false);
  };

  return (
    <div className="relative">
      {/* Expanded Menu */}
      {isExpanded && (
        <div className="absolute top-16 right-0 bg-gray-800 rounded-lg shadow-xl p-2 min-w-[160px]">
          {quickActions.map(item => (
            <button
              key={item.id}
              onClick={() => handleAction(item.action)}
              className="w-full flex items-center gap-2 px-3 py-2 text-white hover:bg-gray-700 rounded transition-colors"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-700 transition-all"
      >
        {isExpanded ? '✖️' : '⚡'}
      </button>
    </div>
  );
}
