'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface OrgState {
  cnpj: string;
  name: string;
  areas: string[];
  isOnboarded: boolean;
}

interface OrgContextValue extends OrgState {
  setOrg: (state: Partial<OrgState>) => void;
  clearOrg: () => void;
}

const DEFAULT_STATE: OrgState = {
  cnpj: '',
  name: '',
  areas: [],
  isOnboarded: false,
};

const STORAGE_KEY = 'capta:org';

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrgState] = useState<OrgState>(DEFAULT_STATE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOrgState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
    } catch {
      // ignore corrupted storage
    }
  }, []);

  const setOrg = useCallback((partial: Partial<OrgState>) => {
    setOrgState((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, []);

  const clearOrg = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setOrgState(DEFAULT_STATE);
  }, []);

  return <OrgContext.Provider value={{ ...org, setOrg, clearOrg }}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
