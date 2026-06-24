import type { PrismaClient } from '@prisma/client';

export interface MappedOpportunity {
  title: string;
  source: string;
  type: 'EDITAL' | 'LEI' | 'PRIVADO';
  sourceType: 'api' | 'scraper' | 'manual';
  sourceUrl: string;
  portalUrl: string;
  deadline: Date;
  // Prazos distintos (opcionais; submissionDeadline default = deadline)
  submissionDeadline?: Date;
  executionDeadline?: Date;
  fundraisingWindowStart?: Date;
  fundraisingWindowEnd?: Date;
  sourceStatus?: string;
  value: number;
  areas: string[];
  summary: string;
  pdfUrl?: string;
  isActive: boolean;
}

export interface CollectorResult {
  source: string;
  itemsFound: number;
  itemsUpserted: number;
  error?: string;
}

export interface CollectorConfig {
  baseUrl: string;
  maxRequestsPerSecond?: number;
  timeoutMs?: number;
}

export type CollectorRunOptions = {
  prisma: PrismaClient;
};
