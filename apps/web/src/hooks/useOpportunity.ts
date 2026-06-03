import { useQuery } from '@tanstack/react-query';
import { fetchOpportunity } from '@/lib/api';

export function useOpportunity(id: string) {
  return useQuery({
    queryKey: ['opportunity', id],
    queryFn: () => fetchOpportunity(id),
    enabled: Boolean(id),
  });
}
