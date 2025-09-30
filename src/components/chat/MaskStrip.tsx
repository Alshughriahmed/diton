"use client";

import { useState } from "react";
import { useFilters } from "@/state/filters";
import { emit } from "@/utils/events";

type MaskType = 'none' | 'cat' | 'dog' | 'bunny' | 'robot' | 'angel' | 'devil' | 'alien';

interface MaskOption {
  type: MaskType;
  emoji: string;
  name: string;
  vipOnly?: boolean;
}

const maskOptions: MaskOption[] = [
  { type: 'none', emoji: '❌', name: 'None' },
  { type: 'cat', emoji: '🐱', name: 'Cat' },
  { type: 'dog', emoji: '🐶', name: 'Dog' },
  { type: 'bunny', emoji: '🐰', name: 'Bunny' },
  { type: 'robot', emoji: '🤖', name: 'Robot', vipOnly: true },
  { type: 'angel', emoji: '😇', name: 'Angel', vipOnly: true },
  { type: 'devil', emoji: '😈', name: 'Devil', vipOnly: true },
  { type: 'alien', emoji: '👽', name: 'Alien', vipOnly: true },
];

export default function MaskStrip() {
  const { isVip } = useFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMask, setSelectedMask] = useState<MaskType>('none');

  const handleMaskSelect = (maskType: MaskType) => {
    const maskOption = maskOptions.find(opt => opt.type === maskType);
    
    if (maskOption?.vipOnly && !isVip) {
      alert("Premium masks are VIP only! Upgrade to access the full mask collection.");
      return;
    }

    setSelectedMask(maskType);
    emit("ui:changeMask", { type: maskType });
    
    // Auto-close for mobile
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  const currentMask = maskOptions.find(opt => opt.type === selectedMask) || maskOptions[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
          selectedMask !== 'none'
            ? "bg-purple-600 border-purple-500 text-white"
            : "bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
        }`}
        aria-label="Face Masks"
      >
        <span className="text-lg">{currentMask.emoji}</span>
        <span className="hidden sm:inline">Masks</span>
        <span className="text-xs opacity-70">▼</span>
      </button>

      {/* Mask Strip */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 p-3 w-80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Face Masks</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Horizontal scrollable mask strip */}
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
            {maskOptions.map((mask) => {
              const isSelected = selectedMask === mask.type;
              const isLocked = mask.vipOnly && !isVip;
              
              return (
                <button
                  key={mask.type}
                  onClick={() => handleMaskSelect(mask.type)}
                  disabled={isLocked}
                  className={`flex-shrink-0 relative w-16 h-16 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                    isSelected
                      ? "border-purple-500 bg-purple-600/30"
                      : isLocked
                      ? "border-gray-600 bg-gray-700/50 cursor-not-allowed"
                      : "border-gray-600 bg-gray-700 hover:border-purple-400 hover:bg-purple-600/20"
                  }`}
                >
                  <span className={`text-2xl ${isLocked ? 'grayscale opacity-50' : ''}`}>
                    {mask.emoji}
                  </span>
                  <span className={`text-xs mt-1 ${isLocked ? 'text-gray-500' : 'text-gray-300'}`}>
                    {mask.name}
                  </span>
                  
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                      <span className="text-yellow-400 text-lg">🔒</span>
                    </div>
                  )}
                  
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white">✓</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* VIP Notice */}
          {!isVip && (
            <div className="mt-3 p-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg">
              <p className="text-xs text-gray-200 text-center">
                🎭 Upgrade to VIP for premium masks and filters!
              </p>
              <div className="flex justify-center mt-2 gap-1">
                {maskOptions.filter(mask => mask.vipOnly).map(mask => (
                  <span key={mask.type} className="text-lg opacity-75">{mask.emoji}</span>
                ))}
              </div>
            </div>
          )}

          {/* Usage tip */}
          <div className="mt-3 p-2 bg-gray-700/50 rounded text-xs text-gray-400 text-center">
            💡 Position your face in view for best mask tracking
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}