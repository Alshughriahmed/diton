
"use client";

import { useState, useRef, useEffect } from 'react';

interface Mask {
  id: string;
  name: string;
  emoji: string;
  effect: string;
}

export default function ARMasks() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMask, setSelectedMask] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const masks: Mask[] = [
    { id: 'none', name: 'بدون قناع', emoji: '😊', effect: 'none' },
    { id: 'cat', name: 'قطة', emoji: '🐱', effect: 'cat-ears' },
    { id: 'dog', name: 'كلب', emoji: '🐶', effect: 'dog-ears' },
    { id: 'crown', name: 'تاج', emoji: '👑', effect: 'crown' },
    { id: 'glasses', name: 'نظارة', emoji: '🕶️', effect: 'cool-glasses' },
    { id: 'heart', name: 'قلوب', emoji: '💕', effect: 'heart-eyes' },
    { id: 'flower', name: 'وردة', emoji: '🌸', effect: 'flower-crown' },
    { id: 'mustache', name: 'شارب', emoji: '🥸', effect: 'mustache' }
  ];

  const applyMask = (maskId: string) => {
    setSelectedMask(maskId);
    setIsOpen(false);

    // إرسال الحدث لتطبيق القناع
    window.dispatchEvent(new CustomEvent('mask:change', { 
      detail: { maskId } 
    }));

    // محاكاة تطبيق المرشح على الفيديو
    if (videoRef.current) {
      const video = videoRef.current;
      video.style.filter = getMaskFilter(maskId);
    }
  };

  const getMaskFilter = (maskId: string): string => {
    switch (maskId) {
      case 'cat':
      case 'dog':
        return 'sepia(0.3) saturate(1.2)';
      case 'crown':
        return 'brightness(1.1) contrast(1.1)';
      case 'glasses':
        return 'contrast(1.2) saturate(0.8)';
      case 'heart':
        return 'hue-rotate(315deg) saturate(1.5)';
      case 'flower':
        return 'hue-rotate(45deg) saturate(1.3) brightness(1.1)';
      case 'mustache':
        return 'sepia(0.2) contrast(1.1)';
      default:
        return 'none';
    }
  };

  return (
    <>
      {/* زر الأقنعة */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-3 rounded-full transition-all ${
          selectedMask && selectedMask !== 'none'
            ? 'bg-purple-600 text-white' 
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
        title="AR Masks"
      >
        🎭
      </button>

      {/* قائمة الأقنعة */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 bg-white border rounded-xl shadow-2xl p-4 w-72">
          <div className="text-lg font-bold mb-3 text-gray-800">🎭 أقنعة AR</div>
          
          <div className="grid grid-cols-4 gap-3">
            {masks.map(mask => (
              <button
                key={mask.id}
                onClick={() => applyMask(mask.id)}
                className={`aspect-square rounded-xl border-2 transition-all hover:scale-105 ${
                  selectedMask === mask.id
                    ? 'border-purple-500 bg-purple-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{mask.emoji}</div>
                <div className="text-xs font-medium text-gray-700">{mask.name}</div>
              </button>
            ))}
          </div>

          {/* معاينة مباشرة */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-2">المعاينة:</div>
            <div className="w-full h-20 bg-gray-200 rounded-lg flex items-center justify-center relative overflow-hidden">
              {selectedMask && selectedMask !== 'none' ? (
                <div className="text-4xl">{masks.find(m => m.id === selectedMask)?.emoji}</div>
              ) : (
                <span className="text-gray-500 text-sm">بدون قناع</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
