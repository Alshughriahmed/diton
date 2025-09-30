"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFFA } from '@/lib/useFFA';
import { useVip } from '@/hooks/useVip';
import { useFilters } from "@/state/filters";
import { emit } from "@/utils/events";

interface BeautySettings {
  smoothing: number;
  brightening: number;
  eyeEnlargement: number;
  slimming: number;
}

export default function BeautyControls() {
  const ffa = useFFA();
  const { isVip } = useVip();
  const router = useRouter();
  
  const dc: RTCDataChannel | null = (globalThis as any).__ditonaDataChannel ?? null;
  const connected = !!dc && dc.readyState === "open";
  const buttonEnabled = ffa || connected || isVip;
  
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  
  const [settings, setSettings] = useState<BeautySettings>({
    smoothing: 30,
    brightening: 20,
    eyeEnlargement: 10,
    slimming: 10,
  });

  const handleToggleBeauty = () => {
    // Allow opening panel always if button is enabled
    if (!buttonEnabled) return;
    
    const canApply = ffa || isVip;
    if (!canApply) {
      router.push("/plans?ref=beauty");
      return;
    }
    
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    
    emit("ui:toggleBeauty", {
      enabled: newEnabled,
      settings: {
        smoothing: settings.smoothing / 100,
        brightening: settings.brightening / 100,
        eyeEnlargement: settings.eyeEnlargement / 100,
        slimming: settings.slimming / 100,
      }
    });
  };

  const handleSettingChange = (key: keyof BeautySettings, value: number) => {
    const canApply = ffa || isVip;
    if (!canApply) {
      router.push("/plans?ref=beauty");
      return;
    }
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    if (isEnabled) {
      emit("ui:updateBeauty", {
        settings: {
          smoothing: newSettings.smoothing / 100,
          brightening: newSettings.brightening / 100,
          eyeEnlargement: newSettings.eyeEnlargement / 100,
          slimming: newSettings.slimming / 100,
        }
      });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggleBeauty}
        disabled={!buttonEnabled}
        title={!buttonEnabled ? "Available during active connection or FFA" : "Beauty Effects"}
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
          isEnabled && (ffa || isVip)
            ? "bg-pink-600 border-pink-500 text-white"
            : !buttonEnabled 
            ? "bg-neutral-800/50 border-neutral-700/50 text-white/50 cursor-not-allowed"
            : "bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
        }`}
        aria-label="Beauty Effects"
      >
        <span className="text-lg">✨</span>
        <span className="hidden sm:inline">Beauty</span>
        {!buttonEnabled && <span className="text-xs">🔒</span>}
        {buttonEnabled && !(ffa || isVip) && <span className="text-xs">🔒</span>}
        {buttonEnabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="text-xs opacity-70 ml-1"
          >
            ⚙️
          </button>
        )}
      </button>

      {/* Beauty Settings Panel */}
      {isOpen && buttonEnabled && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Beauty Settings</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Smoothing */}
            <div>
              <label className="block text-xs text-gray-300 mb-2">
                Skin Smoothing ({settings.smoothing}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.smoothing}
                onChange={(e) => handleSettingChange('smoothing', Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Brightening */}
            <div>
              <label className="block text-xs text-gray-300 mb-2">
                Skin Brightening ({settings.brightening}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.brightening}
                onChange={(e) => handleSettingChange('brightening', Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Eye Enlargement */}
            <div>
              <label className="block text-xs text-gray-300 mb-2">
                Eye Enlargement ({settings.eyeEnlargement}%)
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={settings.eyeEnlargement}
                onChange={(e) => handleSettingChange('eyeEnlargement', Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Face Slimming */}
            <div>
              <label className="block text-xs text-gray-300 mb-2">
                Face Slimming ({settings.slimming}%)
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={settings.slimming}
                onChange={(e) => handleSettingChange('slimming', Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            <div className="pt-2 border-t border-gray-600">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleSettingChange('smoothing', 0);
                    handleSettingChange('brightening', 0);
                    handleSettingChange('eyeEnlargement', 0);
                    handleSettingChange('slimming', 0);
                  }}
                  className="flex-1 px-3 py-2 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    handleSettingChange('smoothing', 30);
                    handleSettingChange('brightening', 20);
                    handleSettingChange('eyeEnlargement', 10);
                    handleSettingChange('slimming', 10);
                  }}
                  className="flex-1 px-3 py-2 text-xs bg-pink-600 text-white rounded hover:bg-pink-700 transition-colors"
                >
                  Default
                </button>
              </div>
            </div>
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

/* CSS for custom slider styling */
const sliderStyles = `
  .slider::-webkit-slider-thumb {
    appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #ec4899;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 1px #ec4899;
  }

  .slider::-moz-range-thumb {
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #ec4899;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 1px #ec4899;
  }
`;

// Inject styles
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = sliderStyles;
  document.head.appendChild(styleSheet);
}