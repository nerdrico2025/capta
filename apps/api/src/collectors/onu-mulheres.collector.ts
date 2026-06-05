import type { PrismaClient } from '@prisma/client';
import { load } from 'cheerio';
import { enrichmentService } from '../services/enrichment.service.js';
import { upsertOpportunity } from './base.collector.js';
import { RateLimiter } from './rate-limiter.js';
import type { CollectorResult, MappedOpportunity } from './types.js';

const SOURCE = 'ONU_MULHERES';
const PAGE_URL = 'https://www.onumulheres.org.br/category/chamadas-e-editais/';
const UA = 'Mozilla/5.0 (compatible; CaptaBot/1.0; +https://capta.org.br)';

const deadlineFallback = () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60);
}

function extractBlocks(html: string): Array<{ html: string; url: string | null }> {
  const $ = load(html);
  $('nav, header, footer, script, style, noscript').remove();

  const seen = new Set<string>();
  const blocks: Array<{ html: string; url: string | null }> = [];

  const selectors = ['article', '.post', 'h2 a', '[class*="entry"]'];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length < 80) return;
      const key = text.slice(0, 100);
      if (seen.has(key)) return;
      seen.add(key);

      const url = $(el).find('a').first().attr('href') ?? $(el).closest('a').attr('href') ?? null;
      blocks.push({ html: $(el).html() ?? text, url });
    });
    if (blocks.length > 0) break;
  }

  return blocks.slice(0, 30);
}

export class OnuMulheresCollector {
  readonly source = SOURCE;
  private readonly rateLimiter = new RateLimiter(0.5);

  async run({ prisma }: { prisma: PrismaClient }): Promise<CollectorResult> {
    const log = await prisma.ingestLog.create({
      data: { source: this.source, status: 'RUNNING' },
    });

    let itemsFound = 0;
    let itemsUpserted = 0;
    let errorMessage: string | undefined;

    try {
      const html = await this.fetchPage();

      if (html) {
        const blocks = extractBlocks(html);
        itemsFound = blocks.length;

        for (const block of blocks) {
          try {
            const extracted = await enrichmentService.extractFromFreeText(
              block.html,
              new Date().toISOString(),
            );
            if (!extracted || !extracted.title || extracted.title.length < 10) continue;
            if (extracted.deadline && extracted.deadline < new Date()) continue;

            const sourceUrl =
              block.url ?? extracted.sourceUrl ?? `${PAGE_URL}#${slugify(extracted.title)}`;

            const mapped: MappedOpportunity = {
              title: extracted.title,
              source: this.source,
              type: 'EDITAL',
              sourceType: 'scraper',
              sourceUrl,
              portalUrl: sourceUrl,
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

  private async fetchPage(): Promise<string | null> {
    await this.rateLimiter.acquire();

    const res = await fetch(PAGE_URL, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    });

    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      console.warn(`[${SOURCE}] HTTP ${res.status} — skipping`);
      return null;
    }

    if (!res.ok) throw new Error(`${SOURCE} respondeu ${res.status}`);

    return res.text();
  }
}
