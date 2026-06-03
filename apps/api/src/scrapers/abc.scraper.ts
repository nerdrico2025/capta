import * as cheerio from 'cheerio';
import { BaseScraper } from './base.scraper.js';
import { buildHeaders, randomDelay, withRetry } from './utils/anti-block.js';
import type { MappedOpportunity } from '../collectors/types.js';

// Associação Brasileira de Captadores (ABC)
// https://captadores.org.br/
// Scrapes the editais/oportunidades listing (HTML + RSS fallback)

const BASE_URL = 'https://captadores.org.br';
const LISTING_URL = `${BASE_URL}/oportunidades/`;
const RSS_URL = `${BASE_URL}/feed/`;
const MAX_PAGES = 5;

interface RawItem {
  title: string;
  url: string;
  deadline?: string;
  description?: string;
  publishedAt?: string;
}

export class AbcScraper extends BaseScraper {
  readonly source = 'ABC Captadores';

  async scrape(): Promise<unknown[]> {
    return withRetry(() => this._scrape(), 3, 'ABC');
  }

  private async _scrape(): Promise<RawItem[]> {
    // Try RSS first (cheaper, no JS needed)
    const rssItems = await this._scrapeRss();
    if (rssItems.length > 0) return rssItems;

    // Fallback to HTML scraping
    return this._scrapeHtml();
  }

  private async _scrapeRss(): Promise<RawItem[]> {
    try {
      await randomDelay(500, 1500);
      const res = await fetch(RSS_URL, {
        headers: buildHeaders({ Accept: 'application/rss+xml, application/xml, text/xml' }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) return [];
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      const items: RawItem[] = [];

      $('item').each((_, el) => {
        const $el = $(el);
        const title = $el.find('title').text().trim();
        const url = $el.find('link').text().trim() || $el.find('guid').text().trim();
        const description = $el
          .find('description')
          .text()
          .replace(/<[^>]+>/g, '')
          .trim()
          .slice(0, 300);
        const publishedAt = $el.find('pubDate').text().trim();

        if (!title || !url) return;

        // Filter by category: only "Editais" or "Oportunidades"; exclude "Vagas"
        const categories = $el
          .find('category')
          .map((_, c) => $(c).text().trim().toLowerCase())
          .get();
        const hasVagas = categories.some((c) => c === 'vagas' || c === 'gestão / outros');
        const hasEdital = categories.some(
          (c) => c.includes('edital') || c.includes('oportunidade'),
        );

        if (hasVagas) return;
        // Accept if categorized as edital, OR if title strongly signals edital
        if (!hasEdital && !/edital|chamamento|chamada aberta|seleção pública/i.test(title)) return;

        const deadline = extractDeadline(description);

        items.push({
          title,
          url,
          description: description || undefined,
          publishedAt: publishedAt || undefined,
          deadline,
        });
      });

      console.log(`[ABC] RSS: ${items.length} items`);
      return items;
    } catch (err) {
      console.warn('[ABC] RSS failed, falling back to HTML:', err);
      return [];
    }
  }

  private async _scrapeHtml(): Promise<RawItem[]> {
    const allItems: RawItem[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      await randomDelay(1200, 2500);

      const url = page === 1 ? LISTING_URL : `${LISTING_URL}page/${page}/`;

      let html: string;
      try {
        const res = await fetch(url, {
          headers: buildHeaders(),
          signal: AbortSignal.timeout(20_000),
        });
        if (res.status === 404) break;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        html = await res.text();
      } catch (err) {
        console.warn(`[ABC] HTML page ${page} failed:`, err);
        break;
      }

      const $ = cheerio.load(html);
      const pageItems: RawItem[] = [];

      $('article, .post, .oportunidade-item').each((_, el) => {
        const $el = $(el);

        const titleEl = $el.find('h2 a, h3 a, .entry-title a').first();
        const title = titleEl.text().trim();
        let postUrl = titleEl.attr('href') ?? '';
        if (!title || !postUrl) return;
        if (postUrl.startsWith('/')) postUrl = `${BASE_URL}${postUrl}`;

        const content = $el.find('.entry-content, .excerpt, p').text();
        const deadline = extractDeadline(content);
        const description = $el
          .find('.entry-summary, .excerpt, p')
          .first()
          .text()
          .trim()
          .slice(0, 300);
        const publishedAt = $el.find('time').attr('datetime');

        pageItems.push({
          title,
          url: postUrl,
          deadline,
          description: description || undefined,
          publishedAt: publishedAt || undefined,
        });
      });

      if (pageItems.length === 0) break;
      allItems.push(...pageItems);
      console.log(`[ABC] HTML page ${page}: ${pageItems.length} items`);
    }

    return allItems;
  }

  mapItem(raw: unknown): MappedOpportunity | null {
    const item = raw as RawItem;
    if (!item.title || !item.url) return null;

    // If no deadline found, use publication date + 30 days as estimate
    let deadline: Date | null = item.deadline ? parseDeadline(item.deadline) : null;
    if (!deadline && item.publishedAt) {
      const pub = new Date(item.publishedAt);
      if (!isNaN(pub.getTime())) {
        deadline = new Date(pub.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }
    if (!deadline || deadline < new Date()) return null;

    return {
      title: item.title,
      source: this.source,
      type: 'PRIVADO',
      sourceType: 'scraper',
      sourceUrl: item.url,
      portalUrl: LISTING_URL,
      deadline,
      value: 0,
      areas: ['captação de recursos'],
      summary: item.description ?? 'Oportunidade via Associação Brasileira de Captadores (ABC).',
      isActive: true,
    };
  }
}

function extractDeadline(text: string): string | undefined {
  const patterns = [
    /prazo[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /inscri[çc][õo]es\s+até\s+(\d{2}\/\d{2}\/\d{4})/i,
    /até\s+(\d{2}\/\d{2}\/\d{4})/i,
    /encerramento[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return undefined;
}

function parseDeadline(raw: string): Date | null {
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const d = new Date(`${br[3]}-${br[2]}-${br[1]}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(raw);
  return isNaN(iso.getTime()) ? null : iso;
}
