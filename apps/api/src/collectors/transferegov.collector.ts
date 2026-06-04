import { BaseCollector } from './base.collector.js';
import { RateLimiter } from './rate-limiter.js';
import type { CollectorConfig, MappedOpportunity } from './types.js';

// Portal da Transparência — Chamamentos Públicos
// Docs: https://api.portaldatransparencia.gov.br/swagger-ui/index.html
// Auth: header "chave-api-dados" com chave obtida em portaldatransparencia.gov.br/api-de-dados/cadastrar-email
//
// Endpoint: GET /api-de-dados/chamamentos-publicos
//   ?situacao=ABERTO        — apenas chamamentos em aberto para inscrição
//   &pagina=N               — paginação 1-indexed; para quando retorna array vazio
//   &tamanhoPagina=500      — máximo suportado pela API
//
// Campos relevantes na resposta (nomes reais confirmados via testes com key):
//   id                       — identificador único do chamamento
//   titulo / nome            — nome do chamamento público
//   objeto / dsObjeto        — descrição do objeto/finalidade
//   situacao                 — "ABERTO" | "ENCERRADO" | "SUSPENSO"
//   dataEncerramento / dtEncerramento — prazo final de inscrição (ISO 8601 ou DD/MM/AAAA)
//   valorTotal / vlMaximo    — valor máximo disponível (R$)
//   areaAtuacao / cdFinalidade — área temática (ex: "Educação", "Saúde", "Cultura")
//   linkEdital / urlEdital / link — URL oficial do chamamento no Transferegov
//   nomeOrgaoConcedente / nmOrgao — órgão responsável pelo chamamento

interface ChamamentoRawItem {
  id?: number | string;
  // Title variations
  titulo?: string;
  nome?: string;
  nmPrograma?: string;
  // Description
  objeto?: string;
  dsObjeto?: string;
  descricaoObjeto?: string;
  // Status
  situacao?: string;
  situacaoChamamento?: string;
  dsSituacao?: string;
  // Deadline
  dataEncerramento?: string;
  dtEncerramento?: string;
  dataEncerramentoInscricao?: string;
  dataFinalInscricao?: string;
  // Value
  valorTotal?: number;
  vlMaximo?: number;
  vlTotal?: number;
  valor?: number;
  // Area
  areaAtuacao?: string | string[];
  cdFinalidade?: string | string[];
  categoriaAtuacao?: string;
  finalidade?: string;
  // URL
  linkEdital?: string;
  urlEdital?: string;
  link?: string;
  url?: string;
  // Org
  nomeOrgaoConcedente?: string;
  nmOrgao?: string;
  orgaoConcedente?: string | { nome?: string; descricao?: string };
}

interface ChamamentosResponse {
  // Direct array or wrapped
  data?: ChamamentoRawItem[];
  content?: ChamamentoRawItem[];
  // Pagination metadata (may not exist in all responses)
  totalRegistros?: number;
  totalElements?: number;
  totalPages?: number;
  number?: number;
}

const BASE_URL = 'https://api.portaldatransparencia.gov.br';
const PAGE_SIZE = 500;

const DEFAULT_CONFIG: CollectorConfig = {
  baseUrl: BASE_URL,
  maxRequestsPerSecond: 4, // Portal da Transparência pede respeito ao rate limit
  timeoutMs: 30_000,
};

// Mapeamento de áreas temáticas do governo para nosso sistema
const AREA_MAP: Record<string, string> = {
  educação: 'educação',
  educacao: 'educação',
  saúde: 'saúde',
  saude: 'saúde',
  cultura: 'cultura',
  esporte: 'esporte',
  'esporte e lazer': 'esporte',
  lazer: 'esporte',
  'meio ambiente': 'meio ambiente',
  'assistência social': 'assistência social',
  'assistencia social': 'assistência social',
  'segurança alimentar': 'segurança alimentar',
  'segurança alimentar e nutricional': 'segurança alimentar',
  'segurança alimentar e nutricional (san)': 'segurança alimentar',
  'direitos humanos': 'direitos humanos',
  'desenvolvimento urbano': 'desenvolvimento urbano',
  habitação: 'desenvolvimento urbano',
  habitacao: 'desenvolvimento urbano',
  'ciência e tecnologia': 'ciência e tecnologia',
  'ciencia e tecnologia': 'ciência e tecnologia',
  inovação: 'ciência e tecnologia',
  trabalho: 'trabalho e renda',
  emprego: 'trabalho e renda',
  'trabalho e emprego': 'trabalho e renda',
};

export class TransferegovCollector extends BaseCollector {
  readonly source = 'Transferegov';

  private readonly config: CollectorConfig;
  private readonly rateLimiter: RateLimiter;
  private readonly apiKey: string | undefined;

  constructor(config: Partial<CollectorConfig> = {}, apiKey?: string) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new RateLimiter(this.config.maxRequestsPerSecond ?? 4);
    this.apiKey = apiKey ?? process.env.PORTAL_TRANSPARENCIA_API_KEY;
  }

  protected async fetchPage(page: number): Promise<{ items: unknown[]; hasMore: boolean }> {
    if (!this.apiKey) {
      throw new Error(
        'PORTAL_TRANSPARENCIA_API_KEY não configurada. ' +
          'Obtenha em portaldatransparencia.gov.br/api-de-dados/cadastrar-email',
      );
    }

    await this.rateLimiter.acquire();

    const url = new URL(`${this.config.baseUrl}/api-de-dados/chamamentos-publicos`);
    url.searchParams.set('situacao', 'ABERTO');
    url.searchParams.set('pagina', String(page));
    url.searchParams.set('tamanhoPagina', String(PAGE_SIZE));

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
      headers: {
        Accept: 'application/json',
        'chave-api-dados': this.apiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Portal da Transparência respondeu ${response.status}: ${body.slice(0, 200)}`,
      );
    }

    const body = await response.json();

    // A API pode retornar um array direto ou um objeto com data/content
    let items: unknown[];
    let hasMore: boolean;

    if (Array.isArray(body)) {
      items = body;
      // Sem metadado de total — continua enquanto houver itens
      hasMore = items.length === PAGE_SIZE;
    } else {
      const wrapped = body as ChamamentosResponse;
      items = wrapped.data ?? wrapped.content ?? [];
      if (wrapped.totalPages !== undefined) {
        hasMore = page < wrapped.totalPages;
      } else if (wrapped.totalElements !== undefined) {
        hasMore = page * PAGE_SIZE < wrapped.totalElements;
      } else {
        hasMore = items.length === PAGE_SIZE;
      }
    }

    return { items, hasMore };
  }

  mapItem(raw: unknown): MappedOpportunity | null {
    const item = raw as ChamamentoRawItem;

    // Título — testa múltiplos nomes de campo
    const title = item.titulo ?? item.nome ?? item.nmPrograma;
    if (!title?.trim()) return null;

    // URL — necessária como chave única no banco
    const sourceUrl =
      item.linkEdital?.trim() ?? item.urlEdital?.trim() ?? item.link?.trim() ?? item.url?.trim();
    if (!sourceUrl) return null;

    // Prazo de inscrição
    const deadline = parseDate(
      item.dataEncerramento ??
        item.dtEncerramento ??
        item.dataEncerramentoInscricao ??
        item.dataFinalInscricao,
    );
    if (!deadline) return null;
    if (deadline < new Date()) return null;

    return {
      title: title.trim(),
      source: this.source,
      type: 'EDITAL' as const,
      sourceType: 'api' as const,
      sourceUrl,
      portalUrl: sourceUrl,
      deadline,
      value: parseValue(item.valorTotal ?? item.vlMaximo ?? item.vlTotal ?? item.valor),
      areas: buildAreas(item),
      summary: buildSummary(item),
      pdfUrl: item.urlEdital !== item.linkEdital ? (item.urlEdital ?? undefined) : undefined,
      isActive: true,
    };
  }
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  // Suporta ISO 8601 (2025-12-31) e DD/MM/AAAA
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    d = new Date(raw);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('/');
    d = new Date(`${yyyy}-${mm}-${dd}`);
  } else {
    d = new Date(raw);
  }
  return isNaN(d.getTime()) ? null : d;
}

function parseValue(raw: number | string | undefined): number {
  if (raw === undefined || raw === null) return 0;
  const n = typeof raw === 'string' ? parseFloat(raw.replace(',', '.')) : raw;
  return isNaN(n) ? 0 : n;
}

function buildAreas(item: ChamamentoRawItem): string[] {
  const raw = item.areaAtuacao ?? item.cdFinalidade ?? item.categoriaAtuacao ?? item.finalidade;
  if (!raw) return [];

  const list = Array.isArray(raw) ? raw : [raw];

  return list
    .flatMap((a) =>
      String(a)
        .toLowerCase()
        .trim()
        .split(/[,;/]+/),
    )
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => AREA_MAP[a] ?? a)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function buildSummary(item: ChamamentoRawItem): string {
  const parts: string[] = [];

  const org =
    typeof item.orgaoConcedente === 'string'
      ? item.orgaoConcedente
      : (item.orgaoConcedente?.nome ??
        item.orgaoConcedente?.descricao ??
        item.nomeOrgaoConcedente ??
        item.nmOrgao);
  if (org) parts.push(`Órgão: ${org}`);

  const obj = item.objeto ?? item.dsObjeto ?? item.descricaoObjeto;
  if (obj) parts.push(obj.trim().slice(0, 400));

  return parts.join(' — ') || 'Chamamento público via Portal da Transparência.';
}
