import type { PrismaClient } from '@prisma/client';
import { load } from 'cheerio';
import { enrichmentService } from '../services/enrichment.service.js';
import { upsertOpportunity } from './base.collector.js';
import { RateLimiter } from './rate-limiter.js';
import type { CollectorResult, MappedOpportunity } from './types.js';

const SOURCE = 'ITAU_SOCIAL';
const PAGE_URL = 'https://www.itausocial.org.br/editais/';
const UA = 'Mozilla/5.0 (compatible; CaptaBot/1.0; +https://capta.org.br)';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60);
}

interface Block {
  html: string;
  href: string | null;
}

function extractBlocks(html: string): Block[] {
  const $ = load(html);
  $('nav, header, footer, script, style, noscript').remove();

  const seen = new Set<string>();
  const blocks: Block[] = [];

  // Itaú Social usa <article> e divs com classe "programa" ou "card"
  const selectors = ['article', '[class*="programa"]', '[class*="card"]', '[class*="item"]'];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const $el = $(el);
      const text = $el.text().replace(/\s+/g, ' ').trim();
      if (text.length < 80) return;
      const key = text.slice(0, 100);
      if (seen.has(key)) return;
      seen.add(key);

      // Extrai o primeiro href http(s) absoluto do bloco (resolve URLs
      // relativas contra PAGE_URL). Ignora #, javascript:, mailto:, tel:.
      let href: string | null = null;
      $el.find('a[href]').each((_, a) => {
        if (href) return;
        const raw = ($(a).attr('href') ?? '').trim();
        if (!raw || /^(#|javascript:|mailto:|tel:)/i.test(raw)) return;
        try {
          const abs = new URL(raw, PAGE_URL).toString();
          if (abs.startsWith('http')) href = abs;
        } catch {
          /* href malformado — ignora */
        }
      });

      blocks.push({ html: $el.html() ?? text, href });
    });
    if (blocks.length > 0) break;
  }

  return blocks.slice(0, 30);
}

export class ItauSocialCollector {
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

        for (const { html: block, href } of blocks) {
          try {
            const extracted = await enrichmentService.extractFromFreeText(
              block,
              new Date().toISOString(),
            );
            if (!extracted || !extracted.title || extracted.title.length < 10) continue;

            // Exige prazo real e futuro — sem fallback fabricado. Sem deadline
            // extraível, o item é descartado (não inventamos data).
            if (!extracted.deadline) continue;
            if (extracted.deadline < new Date()) continue;

            // sourceUrl: prioriza o href real do HTML; nunca aceita texto de
            // link ("Acessar"), string vazia ou URL relativa.
            const llmUrl = extracted.sourceUrl.startsWith('http') ? extracted.sourceUrl : null;
            const sourceUrl = href ?? llmUrl ?? `${PAGE_URL}#${slugify(extracted.title)}`;

            const mapped: MappedOpportunity = {
              title: extracted.title,
              source: this.source,
              type: 'PRIVADO',
              sourceType: 'scraper',
              sourceUrl,
              portalUrl: PAGE_URL,
              deadline: extracted.deadline,
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
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    });

    if (res.status === 403 || res.status === 429) {
      console.warn(`[${SOURCE}] HTTP ${res.status} — skipping`);
      return null;
    }

    if (!res.ok) throw new Error(`${SOURCE} respondeu ${res.status}`);

    return res.text();
  }
}
