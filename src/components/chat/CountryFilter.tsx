"use client";

import { useState, useMemo } from "react";
import { useFilters } from "@/state/filters";
import countries from "world-countries";
import { emit } from "@/utils/events";
import { toast } from "@/lib/ui/toast";

interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export default function CountryFilter() {
  const { countries: selectedCountries, setCountries, isVip } = useFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const countryOptions: CountryOption[] = useMemo(() => {
    return countries.map(c => ({
      code: c.cca2,
      name: c.name.common,
      flag: c.flag
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredCountries = useMemo(() => {
    if (!search) return countryOptions;
    return countryOptions.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
    );
  }, [countryOptions, search]);

  const handleCountryToggle = async (code: string) => {
    const FREE_FOR_ALL = (globalThis as any).__vip?.FREE_FOR_ALL;
    if (!isVip && !FREE_FOR_ALL) {
      toast('🔒 ميزة تصفية الدول حصرية لـ VIP');
      emit('ui:upsell', 'countries');
      return;
    }

    let newSelection: string[];
    if (selectedCountries.includes(code)) {
      newSelection = selectedCountries.filter(c => c !== code);
    } else {
      if (selectedCountries.length >= 15) {
        toast("حد أقصى 15 دولة لمستخدمي VIP");
        return;
      }
      newSelection = [...selectedCountries, code];
    }

    setCountries(newSelection);
    
    // Save to profile store
    try {
      const { useProfile } = await import("@/state/profile");
      const profile = useProfile.getState().profile;
      const updatedProfile = { 
        ...profile, 
        preferences: { 
          ...profile.preferences, 
          countries: newSelection 
        } 
      };
      useProfile.getState().setProfile(updatedProfile);
    } catch (error) {
      console.warn('Failed to save country preference:', error);
    }
    
    emit('filters:country', code);
    toast(`تم ${selectedCountries.includes(code) ? 'إزالة' : 'إضافة'} ${getCountryName(code)}`);
  };

  const handleSelectAll = () => {
    const FREE_FOR_ALL = (globalThis as any).__vip?.FREE_FOR_ALL;
    if (!isVip && !FREE_FOR_ALL) {
      toast('🔒 ميزة تصفية الدول حصرية لـ VIP');
      emit('ui:upsell', 'countries');
      return;
    }
    setCountries([]);
    emit('filters:country', 'all');
  };

  const selectedDisplay = selectedCountries.length === 0 
    ? "All Countries" 
    : `${selectedCountries.length} selected`;

  const getCountryName = (code: string) => {
    const country = countryOptions.find(c => c.code === code);
    return country ? country.name : code;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors"
        aria-label="Select Countries"
      >
        <span>🌍</span>
        <span className="hidden sm:inline">{selectedDisplay}</span>
        <span className="text-xs opacity-70">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-[90] max-h-96 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-600">
            <input
              type="text"
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>

          {/* All Countries Option */}
          <div className="p-2 border-b border-gray-600">
            <button
              onClick={handleSelectAll}
              className={`w-full px-3 py-2 text-left rounded flex items-center gap-2 text-sm transition-colors ${
                selectedCountries.length === 0
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-700 text-gray-200"
              }`}
            >
              <span>🌐</span>
              <span>All Countries</span>
              {selectedCountries.length === 0 && <span className="ml-auto">✓</span>}
            </button>
          </div>

          {/* Countries List - Two Columns */}
          <div className="max-h-64 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-1">
              {filteredCountries.map((country) => {
                const isSelected = selectedCountries.includes(country.code);
                const FREE_FOR_ALL = (globalThis as any).__vip?.FREE_FOR_ALL;
                const isDisabled = !isVip && !FREE_FOR_ALL && !isSelected;
                
                return (
                  <button
                    key={country.code}
                    onClick={() => handleCountryToggle(country.code)}
                    disabled={isDisabled}
                    className={`px-2 py-1.5 text-left rounded flex items-center gap-2 text-xs transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : isDisabled
                        ? "text-gray-500 cursor-not-allowed"
                        : "hover:bg-gray-700 text-gray-200"
                    }`}
                  >
                    <span className="text-sm">{country.flag}</span>
                    <span className="truncate">{country.name}</span>
                    {isSelected && <span className="ml-auto">✓</span>}
                    {!isVip && !isSelected && <span className="ml-auto">🔒</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* VIP Notice */}
          {!isVip && !(globalThis as any).__vip?.FREE_FOR_ALL && (
            <div className="p-3 border-t border-gray-600 bg-gradient-to-r from-purple-600/20 to-blue-600/20">
              <p className="text-xs text-gray-300 text-center">
                🔒 ترقية لـ VIP لفلترة الدول (حتى 15 دولة)
              </p>
            </div>
          )}

          {/* Selected Countries Display */}
          {isVip && selectedCountries.length > 0 && (
            <div className="p-3 border-t border-gray-600">
              <p className="text-xs text-gray-400 mb-2">Selected Countries ({selectedCountries.length}/15):</p>
              <div className="flex flex-wrap gap-1">
                {selectedCountries.slice(0, 5).map(code => (
                  <span key={code} className="text-xs bg-blue-600 px-2 py-1 rounded">
                    {getCountryName(code)}
                  </span>
                ))}
                {selectedCountries.length > 5 && (
                  <span className="text-xs text-gray-400">+{selectedCountries.length - 5} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[85]" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}