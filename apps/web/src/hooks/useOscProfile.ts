import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api';
import { fetchOscByCnpj } from '@/lib/api';
import type { OscProfile } from '@/types/api';

export function useOscProfile(cnpj: string) {
  return useQuery<OscProfile, ApiError>({
    queryKey: ['osc', cnpj],
    queryFn: () => fetchOscByCnpj(cnpj),
    enabled: cnpj.replace(/\D/g, '').length === 14,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
