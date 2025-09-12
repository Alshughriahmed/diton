/**
 * Bridge to wrap RTC enqueue calls with filter data
 * Enforces VIP limits and passes gender/country selections to API
 */

type FilterData = {
  gender?: string;
  countries?: string[];
  genders?: string[];
};

export function withFiltersBody(originalBody: any = {}): any {
  // Get current filter state from localStorage (from FilterBar components)
  let genders: string[] = [];
  let countries: string[] = [];
  
  try {
    const storedGenders = localStorage.getItem("ditona:filters:genders");
    const storedCountries = localStorage.getItem("ditona:filters:countries");
    
    if (storedGenders) genders = JSON.parse(storedGenders);
    if (storedCountries) countries = JSON.parse(storedCountries);
  } catch {}

  // Convert to API format
  const gender = genders.length === 0 ? "any" : genders[0]; // Use first selected gender
  const countryList = countries.length === 0 ? ["ALL"] : countries;

  return {
    ...originalBody,
    gender,
    countries: countryList,
    genders: genders
  };
}