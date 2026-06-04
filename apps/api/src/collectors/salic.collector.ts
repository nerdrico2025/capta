import { BaseCollector } from './base.collector.js';
import { RateLimiter } from './rate-limiter.js';
import type { CollectorConfig, MappedOpportunity } from './types.js';

// SALIC API (new path: /api/v1/projetos — old /v1/projetos returned 404)
// https://api.salic.cultura.gov.br/api/v1/projetos

interface SalicRawItem {
  PRONAC?: string;
  nome?: string;
  data_termino?: string;
  data_inicio?: string;
  segmento?: string; // v2: flat string (was { codigo, descricao })
  UF?: string;
  municipio?: string;
  valor_solicitado?: string | number;
  valor_proposta?: string | number;
  valor_aprovado?: string | number;
  situacao?: string;
  proponente?: string; // v2: flat string (was { nome, tipo_pessoa })
  resumo?: string;
  sinopse?: string;
  tipologia?: string;
}

interface SalicPage {
  _embedded?: { projetos?: SalicRawItem[] };
  count?: number;
  total?: number;
}

const DEFAULT_CONFIG: CollectorConfig = {
  baseUrl: 'https://api.salic.cultura.gov.br',
  maxRequestsPerSecond: 5,
  timeoutMs: 30_000,
};

const SALIC_PORTAL_BASE = 'https://salic.cultura.gov.br/projeto';
const PAGE_SIZE = 100;

export class SalicCollector extends BaseCollector {
  readonly source = 'SALIC';

  private readonly config: CollectorConfig;
  private readonly rateLimiter: RateLimiter;
  private readonly token: string | undefined;

  constructor(config: Partial<CollectorConfig> = {}, token?: string) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new RateLimiter(this.config.maxRequestsPerSecond ?? 5);
    this.token = token ?? process.env.SALIC_API_TOKEN;
  }

  protected async fetchPage(page: number): Promise<{ items: unknown[]; hasMore: boolean }> {
    await this.rateLimiter.acquire();

    const offset = (page - 1) * PAGE_SIZE;
    const url = new URL(`${this.config.baseUrl}/api/v1/projetos`);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
      headers,
    });

    if (!response.ok) {
      throw new Error(`SALIC API responded ${response.status} on page ${page}`);
    }

    const body = (await response.json()) as SalicPage;
    const items = body._embedded?.projetos ?? [];
    const total = body.total ?? 0;
    const hasMore = offset + items.length < total;

    return { items, hasMore };
  }

  mapItem(raw: unknown): MappedOpportunity | null {
    const item = raw as SalicRawItem;

    if (!item.nome || !item.PRONAC) return null;

    const deadline = parseDate(item.data_termino);
    if (!deadline) return null;

    // Only ingest projects with future deadlines
    if (deadline < new Date()) return null;

    const sourceUrl = `${SALIC_PORTAL_BASE}/${item.PRONAC}`;

    return {
      title: item.nome.trim(),
      source: this.source,
      type: 'LEI' as const,
      sourceType: 'api' as const,
      sourceUrl,
      portalUrl: sourceUrl,
      deadline,
      value: parseValue(item.valor_proposta ?? item.valor_solicitado ?? item.valor_aprovado),
      areas: buildAreas(item),
      summary: buildSummary(item),
      isActive: true,
    };
  }
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseValue(raw: string | number | undefined): number {
  if (raw === undefined || raw === null) return 0;
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  return isNaN(n) ? 0 : n;
}

// SALIC (Lei Rouanet) funds exclusively cultural projects — area is always 'cultura'.
function buildAreas(_item: SalicRawItem): string[] {
  return ['cultura'];
}

function buildSummary(item: SalicRawItem): string {
  const parts: string[] = [];
  if (item.proponente) parts.push(`Proponente: ${item.proponente}`);
  if (item.sinopse) parts.push(item.sinopse.trim().slice(0, 300));
  else if (item.resumo) parts.push(item.resumo.trim().slice(0, 300));
  return parts.join(' — ') || 'Projeto cultural via SALIC — Lei Rouanet.';
}
