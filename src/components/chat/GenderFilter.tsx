"use client";

import { useState } from "react";
import { useFilters } from "@/state/filters";
import type { GenderOpt } from "@/state/filters";

interface GenderOption {
  key: GenderOpt;
  label: string;
  symbol: string;
  colors: {
    text: string;
    border: string;
    bg: string;
    rainbow?: boolean;
  };
}

const genderOptions: GenderOption[] = [
  {
    key: "all",
    label: "All",
    symbol: "🌐",
    colors: { text: "text-gray-400", border: "border-gray-400", bg: "bg-gray-400/20" }
  },
  {
    key: "male",
    label: "Male",
    symbol: "♂",
    colors: { text: "text-blue-600", border: "border-blue-600", bg: "bg-blue-600/20" }
  },
  {
    key: "female",
    label: "Female", 
    symbol: "♀",
    colors: { text: "text-red-600", border: "border-red-600", bg: "bg-red-600/20" }
  },
  {
    key: "couple",
    label: "Couple",
    symbol: "⚥",
    colors: { text: "text-red-400", border: "border-red-400", bg: "bg-red-400/20" }
  },
  {
    key: "lgbt",
    label: "LGBT",
    symbol: "🏳️‍🌈",
    colors: { text: "text-purple-600", border: "border-purple-600", bg: "bg-purple-600/20", rainbow: true }
  }
];

const rainbowText = "bg-gradient-to-r from-red-500 via-orange-400 via-yellow-400 via-green-500 via-blue-500 to-purple-600 bg-clip-text text-transparent";

export default function GenderFilter() {
  const { gender, setGender, isVip } = useFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGenders, setSelectedGenders] = useState<GenderOpt[]>(
    gender === "all" ? [] : [gender]
  );

  const handleGenderToggle = (genderKey: GenderOpt) => {
    if (genderKey === "all") {
      setSelectedGenders([]);
      setGender("all");
      setIsOpen(false);
      return;
    }

    if (!isVip) {
      alert("Gender filtering is a VIP feature. Upgrade to filter by specific genders!");
      return;
    }

    let newSelected: GenderOpt[];
    
    if (selectedGenders.includes(genderKey)) {
      newSelected = selectedGenders.filter(g => g !== genderKey);
    } else {
      if (selectedGenders.length >= 2) {
        alert("VIP users can select up to 2 genders maximum.");
        return;
      }
      newSelected = [...selectedGenders, genderKey];
    }

    setSelectedGenders(newSelected);
    
    // Update the main gender state
    if (newSelected.length === 0) {
      setGender("all");
    } else if (newSelected.length === 1) {
      setGender(newSelected[0]);
    } else {
      // For multiple selections, we keep the first one as primary
      setGender(newSelected[0]);
    }
  };

  const currentOption = genderOptions.find(opt => opt.key === gender) || genderOptions[0];
  const displayText = selectedGenders.length === 0 
    ? "All Genders" 
    : selectedGenders.length === 1
    ? currentOption.label
    : `${selectedGenders.length} selected`;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 bg-neutral-800 text-white text-sm border rounded-lg hover:bg-neutral-700 transition-colors ${currentOption.colors.border}`}
        aria-label="Select Gender"
      >
        <span className="text-lg">{currentOption.symbol}</span>
        <span className="hidden sm:inline">{displayText}</span>
        <span className="text-xs opacity-70">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Gender Options */}
          <div className="p-2">
            {genderOptions.map((option) => {
              const isSelected = option.key === "all" 
                ? selectedGenders.length === 0
                : selectedGenders.includes(option.key);
              const isDisabled = !isVip && option.key !== "all";
              
              return (
                <button
                  key={option.key}
                  onClick={() => handleGenderToggle(option.key)}
                  disabled={isDisabled}
                  className={`w-full px-3 py-3 text-left rounded-lg flex items-center gap-3 text-sm transition-colors mb-1 ${
                    isSelected
                      ? `${option.colors.bg} ${option.colors.border} border`
                      : isDisabled
                      ? "text-gray-500 cursor-not-allowed hover:bg-gray-700/50"
                      : "hover:bg-gray-700 text-gray-200"
                  }`}
                >
                  <span className="text-2xl leading-none">{option.symbol}</span>
                  
                  {option.key === "lgbt" ? (
                    <span className={`text-base font-semibold ${option.colors.rainbow ? rainbowText : option.colors.text}`}>
                      {option.label}
                    </span>
                  ) : (
                    <span className={`text-base font-semibold ${isSelected ? 'text-white' : option.colors.text}`}>
                      {option.label}
                    </span>
                  )}
                  
                  {isSelected && <span className="ml-auto text-white">✓</span>}
                  {!isVip && option.key !== "all" && <span className="ml-auto">🔒</span>}
                </button>
              );
            })}
          </div>

          {/* VIP Notice */}
          {!isVip && (
            <div className="p-3 border-t border-gray-600 bg-gradient-to-r from-purple-600/20 to-blue-600/20">
              <p className="text-xs text-gray-300 text-center">
                🔒 Upgrade to VIP to filter by specific genders (up to 2)
              </p>
            </div>
          )}

          {/* Selected Display */}
          {isVip && selectedGenders.length > 0 && (
            <div className="p-3 border-t border-gray-600">
              <p className="text-xs text-gray-400 mb-2">Selected ({selectedGenders.length}/2):</p>
              <div className="flex gap-2">
                {selectedGenders.map(genderKey => {
                  const opt = genderOptions.find(o => o.key === genderKey);
                  return opt ? (
                    <span key={genderKey} className={`text-xs px-2 py-1 rounded border ${opt.colors.bg} ${opt.colors.border}`}>
                      {opt.symbol} {opt.label}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
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