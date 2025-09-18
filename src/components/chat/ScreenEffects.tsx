"use client";

"use client";

import { useState, useEffect } from 'react';

interface Effect {
  id: string;
  type: 'hearts' | 'fireworks' | 'confetti' | 'sparkles';
  duration: number;
}

export default function ScreenEffects() {
  const [activeEffects, setActiveEffects] = useState<Effect[]>([]);

  useEffect(() => {
    // استمع لأحداث التأثيرات
    const handleLike = () => {
      triggerEffect('hearts', 2000);
    };

    const handleMatch = () => {
      triggerEffect('fireworks', 3000);
    };

    const handleMessage = () => {
      triggerEffect('sparkles', 1000);
    };

    window.addEventListener('user:liked', handleLike);
    window.addEventListener('users:matched', handleMatch);
    window.addEventListener('message:sent', handleMessage);

    return () => {
      window.removeEventListener('user:liked', handleLike);
      window.removeEventListener('users:matched', handleMatch);
      window.removeEventListener('message:sent', handleMessage);
    };
  }, []);

  const triggerEffect = (type: Effect['type'], duration: number) => {
    const id = Date.now().toString();
    const effect: Effect = { id, type, duration };
    
    setActiveEffects(prev => [...prev, effect]);
    
    setTimeout(() => {
      setActiveEffects(prev => prev.filter(e => e.id !== id));
    }, duration);
  };

  const renderEffect = (effect: Effect) => {
    switch (effect.type) {
      case 'hearts':
        return (
          <div key={effect.id} className="fixed inset-0 pointer-events-none z-30">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="absolute text-4xl animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${i * 200}ms`,
                  animationDuration: '2s'
                }}
              >
                💖
              </div>
            ))}
          </div>
        );
        
      case 'fireworks':
        return (
          <div key={effect.id} className="fixed inset-0 pointer-events-none z-30">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-4 h-4 bg-gradient-to-r from-red-500 to-yellow-500 rounded-full animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 50}%`,
                  animationDelay: `${i * 500}ms`
                }}
              />
            ))}
          </div>
        );
        
      case 'confetti':
        return (
          <div key={effect.id} className="fixed inset-0 pointer-events-none z-30">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-10px',
                  backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'][i % 5],
                  animationDelay: `${i * 100}ms`,
                  animationDuration: '3s'
                }}
              />
            ))}
          </div>
        );
        
      case 'sparkles':
        return (
          <div key={effect.id} className="fixed inset-0 pointer-events-none z-30">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute text-2xl animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${i * 125}ms`
                }}
              >
                ✨
              </div>
            ))}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <>
      {activeEffects.map(renderEffect)}
    </>
  );
}
