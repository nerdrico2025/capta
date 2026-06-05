import type { PrismaClient } from '@prisma/client';
import { load } from 'cheerio';
import { enrichmentService } from '../services/enrichment.service.js';
import { upsertOpportunity } from './base.collector.js';
import { RateLimiter } from './rate-limiter.js';
import type { CollectorResult, MappedOpportunity } from './types.js';

const SOURCE = 'UE_BRASIL';
const PRIMARY_URL = 'https://www.eeas.europa.eu/delegations/brazil/calls-proposals_pt';
const FALLBACK_URL = 'https://international-partnerships.ec.europa.eu/funding/calls_pt';
const UA = 'Mozilla/5.0 (compatible; CaptaBot/1.0; +https://capta.org.br)';

const OSC_FILTER =
  /brasil|brazil|OSC|sociedade civil|civil society|social|direitos|rights|ambiente|cultura|sa[úu]de/i;

const deadlineFallback = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60);
}

function extractBlocks(html: string): string[] {
  const $ = load(html);
  $('nav, header, footer, script, style, noscript').remove();

  const seen = new Set<string>();
  const blocks: string[] = [];

  const selectors = ['article', '[class*="call"]', '[class*="card"]', '.views-row', 'h3 a', 'h2 a'];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length < 80) return;
      const key = text.slice(0, 100);
      if (seen.has(key)) return;
      if (!OSC_FILTER.test(text)) return;
      seen.add(key);
      blocks.push($(el).html() ?? text);
    });
    if (blocks.length > 0) break;
  }

  return blocks.slice(0, 30);
}

export class UeBrasilCollector {
  readonly source = SOURCE;
  private readonly rateLimiter = new RateLimiter(0.3);

  async run({ prisma }: { prisma: PrismaClient }): Promise<CollectorResult> {
    const log = await prisma.ingestLog.create({
      data: { source: this.source, status: 'RUNNING' },
    });

    let itemsFound = 0;
    let itemsUpserted = 0;
    let errorMessage: string | undefined;

    try {
      let html = await this.fetchPage(PRIMARY_URL);
      let usedUrl = PRIMARY_URL;

      if (!html || extractBlocks(html).length === 0) {
        console.info(`[${SOURCE}] Primária sem blocos — tentando fallback`);
        const fallbackHtml = await this.fetchPage(FALLBACK_URL);
        if (fallbackHtml) {
          html = fallbackHtml;
          usedUrl = FALLBACK_URL;
        }
      }

      if (html) {
        const blocks = extractBlocks(html);
        itemsFound = blocks.length;

        for (const block of blocks) {
          try {
            const extracted = await enrichmentService.extractFromFreeText(
              block,
              new Date().toISOString(),
            );
            if (!extracted || !extracted.title || extracted.title.length < 10) continue;
            if (extracted.deadline && extracted.deadline < new Date()) continue;

            const sourceUrl = extracted.sourceUrl ?? `${usedUrl}#${slugify(extracted.title)}`;

            const mapped: MappedOpportunity = {
              title: extracted.title,
              source: this.source,
              type: 'EDITAL',
              sourceType: 'scraper',
              sourceUrl,
              portalUrl: usedUrl,
              deadline: extracted.deadline ?? deadlineFallback(),
              value: extracted.value ?? 0,
              areas: extracted.areas,
              summary: extracted.summary || extracted.title,
              isActive: true,
            };

            const { id, aiSummary } = await upsertOpportunity(prisma, mapped);
            itemsUpserted++;

            if (!aiSummary) {
              void enrichmentService.enrichOpportunity(prisma, id, {
                title: mapped.title,
                source: mapped.source,
                areas: mapped.areas,
                rawDescription: mapped.summary,
              });
            }
          } catch (err) {
            console.error(`[${SOURCE}] Failed to process block:`, err);
          }
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await prisma.ingestLog.update({
      where: { id: log.id },
      data: {
        status: errorMessage ? 'ERROR' : 'SUCCESS',
        finishedAt: new Date(),
        itemsFound,
        itemsUpserted,
        errorMessage: errorMessage ?? null,
      },
    });

    return { source: this.source, itemsFound, itemsUpserted, error: errorMessage };
  }

  private async fetchPage(url: string): Promise<string | null> {
    await this.rateLimiter.acquire();

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      });

      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        console.warn(`[${SOURCE}] HTTP ${res.status} em ${url} — skipping`);
        return null;
      }

      if (!res.ok) {
        console.warn(`[${SOURCE}] HTTP ${res.status} em ${url}`);
        return null;
      }

      return res.text();
    } catch (err) {
      console.warn(`[${SOURCE}] fetch falhou em ${url}:`, err);
      return null;
    }
  }
}
