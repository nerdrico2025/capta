export type OrganizationSize = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';
export type OpportunityScope = 'NATIONAL' | 'STATE' | 'MUNICIPAL';
export type CompatibilityLevel = 'ALTO' | 'MEDIO' | 'BAIXO';

export interface CompatibilityResult {
  score: number;
  level: CompatibilityLevel;
  reasons: string[];
}

export interface Organization {
  id: string;
  cnpj: string;
  name: string;
  areas: string[];
  size: OrganizationSize;
  location: string;
  createdAt: Date;
}

export interface Opportunity {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  deadline: Date;
  value: number;
  areas: string[];
  summary: string;
  pdfUrl?: string | null;
  portalUrl: string;
  isActive: boolean;
  scope: OpportunityScope;
  scopeLocation?: string | null;
  targetSizes: OrganizationSize[];
  createdAt: Date;
  compatibility?: CompatibilityResult | null;
}

export interface Alert {
  id: string;
  organizationId: string;
  opportunityId: string;
  triggerDays: number;
  sentAt?: Date | null;
}

export interface SavedOpportunity {
  id: string;
  organizationId: string;
  opportunityId: string;
  savedAt: Date;
}

export type ApiResponse<T> = {
  data: T;
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
  };
};

export type ApiError = {
  error: string;
  message: string;
  statusCode: number;
};

export type PaginationParams = {
  page?: number;
  perPage?: number;
};
