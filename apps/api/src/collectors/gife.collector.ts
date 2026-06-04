import type { PrismaClient } from '@prisma/client';
import { enrichmentService } from '../services/enrichment.service.js';
import { upsertOpportunity } from './base.collector.js';
import { RateLimiter } from './rate-limiter.js';
import type { CollectorResult, MappedOpportunity } from './types.js';

// GIFE — WordPress REST API
// Categoria "editais" (ID 25) publica compilações mensais de editais abertos para OSCs.
// Cada post HTML lista vários editais individuais em blocos de parágrafo.
// A extração usa LLM (via EnrichmentService.extractFromFreeText) com fallback por regex.
//
// GET https://gife.org.br/wp-json/wp/v2/posts?categories=25&per_page=10&orderby=date&order=desc

const BASE_URL = 'https://gife.org.br';
const CATEGORY_ID = 25; // "editais"
const POSTS_PER_PAGE = 10;

interface WpPost {
  id: number;
  date: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
}

// Separa o HTML do post em blocos por edital individual.
// A estrutura dos posts GIFE usa <strong> ou <h2>/<h3> para marcar cada edital,
// seguidos de parágrafos com descrição, prazo e link.
function splitIntoBlocks(html: string): string[] {
  // Divide nos marcadores de título de edital (<strong>, <h2>, <h3>)
  const chunks = html.split(/(?=<(?:h[23]|p)[^>]*>(?:<strong>)?[^<]{10,})/i);

  return chunks
    .map((chunk) =>
      chunk
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((c) => c.length > 80); // descarta fragmentos muito curtos
}

export class GifeCollector {
  readonly source = 'GIFE';
  private readonly rateLimiter = new RateLimiter(1); // 1 req/s ao WP

  async run({ prisma }: { prisma: PrismaClient }): Promise<CollectorResult> {
    const log = await prisma.ingestLog.create({
      data: { source: this.source, status: 'RUNNING' },
    });

    let itemsFound = 0;
    let itemsUpserted = 0;
    let errorMessage: string | undefined;

    try {
      const posts = await this.fetchPosts();

      for (const post of posts) {
        const blocks = splitIntoBlocks(post.content.rendered);
        itemsFound += blocks.length;

        for (const block of blocks) {
          try {
            const extracted = await enrichmentService.extractFromFreeText(block, post.date);
            if (!extracted) continue;
            if (!extracted.title || extracted.title.length < 10) continue;

            // Prazo no passado — pula
            if (extracted.deadline && extracted.deadline < new Date()) continue;

            // Usa link do post como sourceUrl se a extração não encontrou URL específica
            const sourceUrl = extracted.sourceUrl || post.link;

            const mapped: MappedOpportunity = {
              title: extracted.title,
              source: this.source,
              type: extracted.type,
              sourceType: 'scraper',
              sourceUrl,
              portalUrl: post.link,
              deadline: extracted.deadline ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // fallback: +30 dias
              value: extracted.value,
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
            console.error(`[GIFE] Failed to process block from post ${post.id}:`, err);
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

  private async fetchPosts(): Promise<WpPost[]> {
    await this.rateLimiter.acquire();

    const url = new URL(`${BASE_URL}/wp-json/wp/v2/posts`);
    url.searchParams.set('categories', String(CATEGORY_ID));
    url.searchParams.set('per_page', String(POSTS_PER_PAGE));
    url.searchParams.set('orderby', 'date');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('status', 'publish');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) throw new Error(`GIFE WP API respondeu ${response.status}`);

    return (await response.json()) as WpPost[];
  }
}
