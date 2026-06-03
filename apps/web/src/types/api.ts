export type OpportunityType = 'EDITAL' | 'LEI' | 'PRIVADO';
export type CompatibilityLevel = 'ALTO' | 'MEDIO' | 'BAIXO';

export interface CompatibilityResult {
  score: number;
  level: CompatibilityLevel;
  reasons: string[];
}

export interface Opportunity {
  id: string;
  title: string;
  source: string;
  type: OpportunityType;
  deadline: string;
  value: number | null;
  areas: string[];
  summary: string;
  compatibility: CompatibilityResult | null;
}

export interface SubmitOpportunityPayload {
  instituteName: string;
  instituteCnpj: string;
  title: string;
  areas: string[];
  deadline: string;
  value: number;
  currency: 'BRL' | 'USD';
  officialLink: string;
  portalLink?: string;
  description: string;
  pdfFileName?: string;
}

export interface OpportunityDetail extends Opportunity {
  sourceUrl: string;
  pdfUrl: string | null;
  portalUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export type OpportunityFilterType = '' | 'edital' | 'lei' | 'privado';
export type DeadlineSort = 'asc' | 'desc';

export interface OpportunityFilters {
  search?: string;
  area?: string;
  type?: OpportunityFilterType;
  deadline?: DeadlineSort;
  page?: number;
  limit?: number;
}

export interface OscProfile {
  cnpj: string;
  name: string;
  size: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';
  areas: string[];
  city: string;
  state: string;
}

export interface Organization {
  id: string;
  cnpj: string;
  name: string;
  size: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';
  areas: string[];
  location: string;
  createdAt: string;
  _existing?: boolean;
}

export interface AlertPreference {
  id: string;
  organizationId: string;
  email: string;
  areas: string[];
  days: number[];
  emailEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  _action?: 'created' | 'updated';
}
