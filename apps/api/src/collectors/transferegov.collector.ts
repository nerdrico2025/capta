import { BaseCollector } from './base.collector.js';
import { RateLimiter } from './rate-limiter.js';
import type { CollectorConfig, MappedOpportunity } from './types.js';

// https://transferegov.sistema.gov.br/api/
// Endpoint de chamamentos públicos ativos

interface TransferegovRawItem {
  idChamamento?: number;
  nmPrograma?: string;
  dsObjeto?: string;
  dtEncerramento?: string;
  vlMaximo?: number;
  link?: string;
  cdFinalidade?: string | string[];
  nmOrgao?: string;
  dsSituacao?: string;
  urlEdital?: string;
}

interface TransferegovPage {
  data?: TransferegovRawItem[];
  totalElements?: number;
  totalPages?: number;
  number?: number; // current page (0-indexed)
}

const DEFAULT_CONFIG: CollectorConfig = {
  baseUrl: 'https://transferegov.sistema.gov.br/api',
  maxRequestsPerSecond: 10,
  timeoutMs: 30_000,
};

export class TransferegovCollector extends BaseCollector {
  readonly source = 'Transferegov';

  private readonly config: CollectorConfig;
  private readonly rateLimiter: RateLimiter;
  private readonly pageSize = 50;

  constructor(config: Partial<CollectorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new RateLimiter(this.config.maxRequestsPerSecond ?? 10);
  }

  protected async fetchPage(page: number): Promise<{ items: unknown[]; hasMore: boolean }> {
    await this.rateLimiter.acquire();

    // page param is 1-indexed in our BaseCollector but TransferGov uses 0-indexed
    const zeroPage = page - 1;
    const url = new URL(`${this.config.baseUrl}/chamamentos`);
    url.searchParams.set('situacao', 'ABERTO');
    url.searchParams.set('page', String(zeroPage));
    url.searchParams.set('size', String(this.pageSize));

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`TransferGov API responded ${response.status} on page ${page}`);
    }

    const body = (await response.json()) as TransferegovPage;
    const items = body.data ?? [];
    const totalPages = body.totalPages ?? 1;
    const hasMore = zeroPage < totalPages - 1;

    return { items, hasMore };
  }

  mapItem(raw: unknown): MappedOpportunity | null {
    const item = raw as TransferegovRawItem;

    if (!item.nmPrograma || !item.link) return null;

    const deadline = parseDate(item.dtEncerramento);
    if (!deadline) return null;

    // Skip already-expired opportunities
    if (deadline < new Date()) return null;

    return {
      title: item.nmPrograma.trim(),
      source: this.source,
      type: 'EDITAL' as const,
      sourceType: 'api' as const,
      sourceUrl: item.link.trim(),
      portalUrl: item.link.trim(),
      deadline,
      value: item.vlMaximo ?? 0,
      areas: normalizeAreas(item.cdFinalidade),
      summary: buildSummary(item),
      pdfUrl: item.urlEdital ?? undefined,
      isActive: true,
    };
  }
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeAreas(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate
}

function buildSummary(item: TransferegovRawItem): string {
  const parts: string[] = [];
  if (item.nmOrgao) parts.push(`Órgão: ${item.nmOrgao}`);
  if (item.dsObjeto) parts.push(item.dsObjeto.trim());
  return parts.join(' — ') || 'Chamamento público via TransferGov.';
}
