import { BaseCollector } from './base.collector.js';
import { RateLimiter } from './rate-limiter.js';
import type { CollectorConfig, MappedOpportunity } from './types.js';

// FINEP — API Liferay Headless (descoberta via análise do bundle JS do portal)
// GET https://www.finep.gov.br/o/c/chamadapublicas
//   ?filter=situacao/key eq 'aberta'   — apenas chamadas abertas
//   &sort=dataDePublicacao:desc
//   &pageSize=50
// Sem autenticação. Sem chave de API.

interface FinepChamada {
  id: number;
  titulo?: string;
  descricaoRawText?: string;
  descricao?: string;
  situacao?: { key: string; name: string };
  tipoDeOportunidade?: { key: string; name: string };
  temaPrincipal?: { key: string; name: string };
  taxonomyCategoryBriefs?: Array<{ taxonomyCategoryId: number; taxonomyCategoryName: string }>;
  prazoProposto?: string;
  vigenciaFim?: string;
  dataDePublicacao?: string;
  regiao?: { key: string; name: string };
  contrapartida?: { key: string; name: string };
  databaseId?: number;
}

interface FinepResponse {
  items?: FinepChamada[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
  lastPage?: number;
}

const BASE_URL = 'https://www.finep.gov.br';
const PAGE_SIZE = 50;

const DEFAULT_CONFIG: CollectorConfig = {
  baseUrl: BASE_URL,
  maxRequestsPerSecond: 2,
  timeoutMs: 30_000,
};

// Tipos reembolsáveis são empréstimos a empresas — não são grants para OSCs
const TIPOS_EXCLUIDOS = new Set(['reembolsavel', 'emprestimo']);

// temaPrincipal.name → vocabulário Capta
const AREA_MAP: Record<string, string> = {
  educação: 'educação',
  educacao: 'educação',
  saúde: 'saúde',
  saude: 'saúde',
  cultura: 'cultura',
  esporte: 'esporte',
  'meio ambiente': 'meio ambiente',
  'meio-ambiente': 'meio ambiente',
  sustentabilidade: 'meio ambiente',
  socioambiental: 'meio ambiente',
  'assistência social': 'assistência social',
  'assistencia social': 'assistência social',
  'inclusão social': 'assistência social',
  'segurança alimentar': 'segurança alimentar',
  'segurança alimentar e nutricional': 'segurança alimentar',
  'direitos humanos': 'direitos humanos',
  'desenvolvimento urbano': 'desenvolvimento urbano',
  'ciência e tecnologia': 'ciência e tecnologia',
  'ciencia e tecnologia': 'ciência e tecnologia',
  inovação: 'ciência e tecnologia',
  inovacao: 'ciência e tecnologia',
  tecnologia: 'ciência e tecnologia',
  'tecnologias digitais e conectividade': 'ciência e tecnologia',
  'tecnologias digitais': 'ciência e tecnologia',
  'inteligência artificial': 'ciência e tecnologia',
  'pesquisa e desenvolvimento': 'ciência e tecnologia',
  pesquisa: 'ciência e tecnologia',
  'ambientes de pesquisa': 'ciência e tecnologia',
  'trabalho e renda': 'trabalho e renda',
  trabalho: 'trabalho e renda',
  empreendedorismo: 'trabalho e renda',
  agricultura: 'segurança alimentar',
  agropecuária: 'segurança alimentar',
  agropecuaria: 'segurança alimentar',
  energia: 'meio ambiente',
  'energia renovável': 'meio ambiente',
  bioeconomia: 'meio ambiente',
  'energia e transição sustentável': 'meio ambiente',
  'agro - bioeconomia e alimentos': 'segurança alimentar',
  'saúde e ciências da vida': 'saúde',
  'saude e ciencias da vida': 'saúde',
  'subvenção econômica': 'ciência e tecnologia',
  'subvencao economica': 'ciência e tecnologia',
  'financiamento não reembolsável a icts': 'ciência e tecnologia',
  semicondutores: 'ciência e tecnologia',
  defesa: 'outros',
  segurança: 'outros',
  infraestrutura: 'outros',
};

function normalizeArea(raw: string): string {
  const key = raw.toLowerCase().trim();
  return AREA_MAP[key] ?? raw.toLowerCase().trim();
}

function buildAreas(item: FinepChamada): string[] {
  const areas: string[] = [];

  if (item.temaPrincipal?.name) {
    areas.push(normalizeArea(item.temaPrincipal.name));
  }

  for (const cat of item.taxonomyCategoryBriefs ?? []) {
    const normalized = normalizeArea(cat.taxonomyCategoryName);
    if (!areas.includes(normalized)) areas.push(normalized);
  }

  return areas.filter(Boolean);
}

function buildSourceUrl(item: FinepChamada): string {
  // URL pública da chamada no portal FINEP
  const slug = item.databaseId && item.databaseId > 0 ? item.databaseId : item.id;
  return `${BASE_URL}/e/chamada-publica/222684/${slug}`;
}

function buildSummary(item: FinepChamada): string {
  const text = item.descricaoRawText ?? item.descricao ?? '';
  // descricao pode ter HTML — usa descricaoRawText quando disponível
  const clean = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, 2000) || `Chamada pública da FINEP: ${item.titulo ?? ''}`;
}

export class FinepCollector extends BaseCollector {
  readonly source = 'FINEP';

  private readonly config: CollectorConfig;
  private readonly rateLimiter: RateLimiter;

  constructor(config: Partial<CollectorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new RateLimiter(this.config.maxRequestsPerSecond ?? 2);
  }

  protected async fetchPage(page: number): Promise<{ items: unknown[]; hasMore: boolean }> {
    await this.rateLimiter.acquire();

    const url = new URL(`${this.config.baseUrl}/o/c/chamadapublicas`);
    url.searchParams.set('sort', 'dataDePublicacao:desc');
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));
    // Nota: o filtro OData para nested keys não funciona nesta versão da API;
    // chamadas abertas são filtradas em mapItem() via situacao.key

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`FINEP respondeu ${response.status}: ${body.slice(0, 200)}`);
    }

    const body = (await response.json()) as FinepResponse;
    const items = body.items ?? [];

    // Liferay retorna lastPage ou calcula a partir de totalCount
    const lastPage =
      body.lastPage ?? (body.totalCount ? Math.ceil(body.totalCount / PAGE_SIZE) : 1);
    const hasMore = page < lastPage && items.length === PAGE_SIZE;

    return { items, hasMore };
  }

  mapItem(raw: unknown): MappedOpportunity | null {
    const item = raw as FinepChamada;

    if (!item.titulo?.trim()) return null;

    // Descarta chamadas não abertas
    if (item.situacao?.key && item.situacao.key !== 'aberta') return null;

    // Descarta tipos reembolsáveis (empréstimos a empresas, não grants)
    const tipoKey = item.tipoDeOportunidade?.key ?? '';
    if (TIPOS_EXCLUIDOS.has(tipoKey)) return null;

    // Deadline: prefere prazoProposto (prazo de submissão), fallback vigenciaFim
    const deadlineRaw = item.prazoProposto ?? item.vigenciaFim;
    if (!deadlineRaw) return null;
    const deadline = new Date(deadlineRaw);
    if (isNaN(deadline.getTime()) || deadline < new Date()) return null;

    const sourceUrl = buildSourceUrl(item);

    return {
      title: item.titulo.trim(),
      source: this.source,
      type: 'EDITAL',
      sourceType: 'api',
      sourceUrl,
      portalUrl: sourceUrl,
      deadline,
      value: 0, // FINEP geralmente não publica valor total no listing
      areas: buildAreas(item),
      summary: buildSummary(item),
      isActive: true,
    };
  }
}
