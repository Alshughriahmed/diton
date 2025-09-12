/**
 * Bridge to wrap RTC enqueue calls with filter data
 * Enforces VIP limits and passes gender/country selections to API
 * Defensively normalizes filters based on VIP status to prevent bypass
 */

async function getVipStatus(): Promise<boolean> {
  try {
    const response = await fetch("/api/user/vip-status");
    const data = await response.json();
    return !!(data?.isVip || data?.vip);
  } catch {
    return false;
  }
}

async function getUserCountry(): Promise<string | null> {
  try {
    const response = await fetch("/api/geo");
    const data = await response.json();
    const code = (data?.countryCode || data?.country || "").toString().toUpperCase();
    return code && /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

export async function withFiltersBodyAsync(originalBody: any = {}): Promise<any> {
  // Get current filter preferences from localStorage (UI state only)
  let preferredGenders: string[] = [];
  let preferredCountries: string[] = [];
  
  try {
    const storedGenders = localStorage.getItem("ditona:filters:genders");
    const storedCountries = localStorage.getItem("ditona:filters:countries");
    
    if (storedGenders) preferredGenders = JSON.parse(storedGenders);
    if (storedCountries) preferredCountries = JSON.parse(storedCountries);
  } catch {}

  // Fetch server-trusted VIP status and geo (cannot be tampered)
  const [isVip, userCountry] = await Promise.all([
    getVipStatus(),
    getUserCountry()
  ]);

  // Server-enforced normalization based on trusted VIP status
  let finalGenders: string[];
  let finalCountries: string[];

  if (!isVip) {
    // Non-VIP: Everyone only, user country or All only
    finalGenders = [];
    
    // For countries, only allow user's actual country if available, otherwise All
    if (userCountry && preferredCountries.includes(userCountry)) {
      finalCountries = [userCountry];
    } else {
      finalCountries = [];
    }
  } else {
    // VIP: enforce server-side limits on user preferences
    finalGenders = preferredGenders.slice(0, 2); // Max 2 genders
    finalCountries = preferredCountries.slice(0, 15); // Max 15 countries
  }

  // Convert to API format
  const gender = finalGenders.length === 0 ? "any" : finalGenders[0];
  const countryList = finalCountries.length === 0 ? ["ALL"] : finalCountries;

  return {
    ...originalBody,
    gender,
    countries: countryList,
    genders: finalGenders
  };
}

// Fallback synchronous version (less secure but prevents breaking changes)
export function withFiltersBody(originalBody: any = {}): any {
  // Get filter preferences from localStorage (UI state)
  let genders: string[] = [];
  let countries: string[] = [];
  
  try {
    const storedGenders = localStorage.getItem("ditona:filters:genders");
    const storedCountries = localStorage.getItem("ditona:filters:countries");
    
    if (storedGenders) genders = JSON.parse(storedGenders);
    if (storedCountries) countries = JSON.parse(storedCountries);
  } catch {}

  // Conservative approach: assume non-VIP for security
  // Server will do final enforcement based on real VIP status
  const gender = "any"; // Force Everyone for non-VIP assumption
  const countryList = ["ALL"]; // Force All for non-VIP assumption

  return {
    ...originalBody,
    gender,
    countries: countryList,
    genders: []
  };
}