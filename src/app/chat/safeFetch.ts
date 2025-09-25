export function safeFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { credentials: "include", cache: "no-store", ...init });
}
