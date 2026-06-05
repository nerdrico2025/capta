import type {
  AlertPreference,
  Opportunity,
  OpportunityDetail,
  OpportunityFilters,
  Organization,
  OscProfile,
  PaginatedResponse,
  SubmitOpportunityPayload,
} from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error ?? res.statusText, body);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function fetchOpportunities(
  filters: OpportunityFilters,
): Promise<PaginatedResponse<Opportunity>> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.area) params.set('area', filters.area);
  if (filters.type) params.set('type', filters.type);
  if (filters.deadline) params.set('deadline', filters.deadline);
  if (filters.source) params.set('source', filters.source);
  if (filters.sourceExclude) params.set('source_exclude', filters.sourceExclude);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  return apiFetch<PaginatedResponse<Opportunity>>(`/api/opportunities${qs ? `?${qs}` : ''}`);
}

export function fetchOpportunity(id: string): Promise<OpportunityDetail> {
  return apiFetch<OpportunityDetail>(`/api/opportunities/${id}`);
}

export function saveOpportunity(
  id: string,
  cnpj: string,
): Promise<{ id: string; savedAt: string }> {
  return apiFetch(`/api/opportunities/${id}/save`, {
    method: 'POST',
    headers: { 'x-org-cnpj': cnpj },
  });
}

export function fetchOscByCnpj(cnpj: string): Promise<OscProfile> {
  return apiFetch<OscProfile>(`/api/organizations/${cnpj}`);
}

export function registerOrganization(data: {
  cnpj: string;
  name: string;
  size?: string;
  areas?: string[];
  city?: string;
  state?: string;
}): Promise<Organization> {
  return apiFetch<Organization>('/api/organizations/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function saveAlertPreferences(data: {
  cnpj: string;
  email: string;
  areas: string[];
  days: (1 | 7 | 15)[];
}): Promise<AlertPreference> {
  return apiFetch<AlertPreference>('/api/alerts/preferences', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function fetchSavedOpportunities(
  cnpj: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<Opportunity>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<PaginatedResponse<Opportunity>>(`/api/opportunities/saved?${params}`, {
    headers: { 'x-org-cnpj': cnpj },
  });
}

export function submitOpportunity(
  data: SubmitOpportunityPayload,
): Promise<{ id: string; message: string }> {
  return apiFetch('/api/opportunities/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
