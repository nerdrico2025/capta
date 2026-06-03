import { BaseScraper } from './base.scraper.js';
import { buildHeaders, randomDelay, withRetry } from './utils/anti-block.js';
import type { MappedOpportunity } from '../collectors/types.js';

// GIFE — Grupo de Institutos, Fundações e Empresas
// Uses WordPress REST API to find edital posts reliably.
// The /editais/ listing page is Elementor-rendered and has no standard article elements.

const BASE_URL = 'https://gife.org.br';
const API_BASE = `${BASE_URL}/wp-json/wp/v2/posts`;
const PORTAL_URL = `${BASE_URL}/editais/`;

const EDITAL_KEYWORDS = [
  'edital',
  'chamada',
  'chamamento',
  'seleção',
  'premiação',
  'apoio financeiro',
];

interface WpPost {
  id: number;
  date: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
}

interface RawItem {
  title: string;
  url: string;
  deadline?: string;
  publishedAt: string;
  description?: string;
}

export class GifeScraper extends BaseScraper {
  readonly source = 'GIFE';

  async scrape(): Promise<unknown[]> {
    return withRetry(() => this._scrape(), 3, 'GIFE');
  }

  private async _scrape(): Promise<RawItem[]> {
    const allItems: RawItem[] = [];
    const seen = new Set<number>();

    // Fetch recent posts matching each keyword
    for (const keyword of EDITAL_KEYWORDS) {
      await randomDelay(600, 1200);

      const url = `${API_BASE}?search=${encodeURIComponent(keyword)}&per_page=20&orderby=date&order=desc`;
      let posts: WpPost[];

      try {
        const res = await fetch(url, {
          headers: buildHeaders({ Accept: 'application/json' }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) continue;
        posts = (await res.json()) as WpPost[];
      } catch (err) {
        console.warn(`[GIFE] REST API error (keyword="${keyword}"):`, err);
        continue;
      }

      for (const post of posts) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);

        const title = post.title.rendered
          .replace(/&#\d+;/g, ' ')
          .replace(/&[a-z]+;/g, ' ')
          .trim();

        // Skip posts that don't look like actual edital announcements
        const titleLower = title.toLowerCase();
        if (!EDITAL_KEYWORDS.some((k) => titleLower.includes(k))) continue;

        const content = post.content.rendered;
        const plainText = content
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const deadline = extractDeadline(plainText);
        const description = post.excerpt.rendered
          .replace(/<[^>]+>/g, '')
          .trim()
          .slice(0, 300);

        allItems.push({
          title,
          url: post.link,
          deadline,
          publishedAt: post.date,
          description: description || undefined,
        });
      }
    }

    console.log(`[GIFE] REST API: ${allItems.length} candidate items`);
    return allItems;
  }

  mapItem(raw: unknown): MappedOpportunity | null {
    const item = raw as RawItem;
    if (!item.title || !item.url) return null;

    let deadline: Date | null = item.deadline ? parseDeadline(item.deadline) : null;

    // Fallback: pub date + 60 days
    if (!deadline && item.publishedAt) {
      const pub = new Date(item.publishedAt);
      if (!isNaN(pub.getTime())) {
        deadline = new Date(pub.getTime() + 60 * 24 * 60 * 60 * 1000);
      }
    }

    if (!deadline || deadline < new Date()) return null;

    return {
      title: item.title,
      source: this.source,
      type: 'PRIVADO',
      sourceType: 'scraper',
      sourceUrl: item.url,
      portalUrl: PORTAL_URL,
      deadline,
      value: 0,
      areas: inferAreas(item.title, item.description ?? ''),
      summary: item.description ?? 'Edital privado via GIFE.',
      isActive: true,
    };
  }
}

function extractDeadline(text: string): string | undefined {
  const patterns = [
    /inscri[çc][õo]es\s+até\s+(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i,
    /prazo[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /até\s+(\d{2}\/\d{2}\/\d{4})/i,
    /encerramento[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /data.{0,20}(\d{2}\/\d{2}\/\d{4})/i,
    /(\d{2}\/\d{2}\/\d{4})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return undefined;
}

function parseDeadline(raw: string): Date | null {
  const br = raw.match(/(\d{1,2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const d = new Date(`${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Try "15 de junho de 2026"
  const ptMonths: Record<string, string> = {
    janeiro: '01',
    fevereiro: '02',
    março: '03',
    abril: '04',
    maio: '05',
    junho: '06',
    julho: '07',
    agosto: '08',
    setembro: '09',
    outubro: '10',
    novembro: '11',
    dezembro: '12',
  };
  const ptMatch = raw.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (ptMatch) {
    const month = ptMonths[ptMatch[2].toLowerCase()];
    if (month) {
      const d = new Date(`${ptMatch[3]}-${month}-${ptMatch[1].padStart(2, '0')}`);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  const iso = new Date(raw);
  return isNaN(iso.getTime()) ? null : iso;
}

function inferAreas(title: string, description: string): string[] {
  const text = (title + ' ' + description).toLowerCase();
  const map: Record<string, string> = {
    cultura: 'cultura',
    educação: 'educação',
    educacao: 'educação',
    saúde: 'saúde',
    saude: 'saúde',
    'meio ambiente': 'meio ambiente',
    ambiental: 'meio ambiente',
    tecnologia: 'tecnologia',
    inovação: 'inovação',
    social: 'assistência social',
    criança: 'criança e adolescente',
    adolescente: 'criança e adolescente',
    mulher: 'gênero',
    lgbtq: 'direitos humanos',
    'povos indígenas': 'direitos humanos',
    esporte: 'esporte',
    habitação: 'habitação',
  };
  const found = new Set<string>();
  for (const [key, area] of Object.entries(map)) {
    if (text.includes(key)) found.add(area);
  }
  return found.size > 0 ? [...found] : ['captação de recursos'];
}
