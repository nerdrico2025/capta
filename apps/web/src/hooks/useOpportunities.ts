import { useQuery } from '@tanstack/react-query';
import { fetchOpportunities } from '@/lib/api';
import type { OpportunityFilters } from '@/types/api';

export function useOpportunities(filters: OpportunityFilters) {
  return useQuery({
    queryKey: ['opportunities', filters],
    queryFn: () => fetchOpportunities(filters),
  });
}
