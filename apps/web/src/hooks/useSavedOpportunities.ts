'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchSavedOpportunities } from '@/lib/api';

export function useSavedOpportunities(cnpj: string, page = 1) {
  return useQuery({
    queryKey: ['opportunities', 'saved', cnpj, page],
    queryFn: () => fetchSavedOpportunities(cnpj, page),
    enabled: !!cnpj,
    staleTime: 2 * 60 * 1000,
  });
}
