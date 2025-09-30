'use client'
import { useEffect, useState } from 'react';

export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}