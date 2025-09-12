export function getRegionCodes(): string[] {
  try {
    const sv = (Intl as any)?.supportedValuesOf;
    const arr = typeof sv === 'function' ? sv('region') : [];
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {
    // Intl.supportedValuesOf('region') can throw RangeError in some environments
  }
  
  // Fallback: use the existing hardcoded list from regions.ts
  // This ensures consistent behavior without crashing
  return [
    "US","GB","DE","FR","IT","ES","CA","BR","AU","RU","CN","JP","KR","IN","SA","AE","TR","NL","SE","NO","DK","FI","PL","GR","EG","MA","TN","ZA","AR","CL","MX",
    // Add more comprehensive list for better coverage
    "AF","AL","DZ","AD","AO","AG","AM","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BT","BO","BA","BW","BG","BF","BI","CV","KH","CM","CF","TD","CL","CO","KM","CG","CD","CR","CI","HR","CU","CY","CZ","DJ","DM","DO","EC","SV","GQ","ER","EE","SZ","ET","FJ","GA","GM","GE","GH","GN","GW","GY","HT","HN","HU","IS","ID","IR","IQ","IE","IL","JM","JO","KZ","KE","KI","KP","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MG","MW","MY","MV","ML","MT","MH","MR","MU","MX","FM","MD","MC","MN","ME","MA","MZ","MM","NA","NR","NP","NZ","NI","NE","NG","MK","OM","PK","PW","PS","PA","PG","PY","PE","PH","PT","QA","RO","RW","KN","LC","VC","WS","SM","ST","SN","RS","SC","SL","SG","SK","SI","SB","SO","KR","SS","LK","SD","SR","SE","CH","SY","TJ","TZ","TH","TL","TG","TO","TT","TN","TM","TV","UG","UA","UY","UZ","VU","VE","VN","YE","ZM","ZW"
  ];
}