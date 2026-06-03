import type { PrismaClient } from '@prisma/client';
import { upsertOpportunity } from '../collectors/base.collector.js';
import type {
  CollectorResult,
  CollectorRunOptions,
  MappedOpportunity,
} from '../collectors/types.js';
import { enrichmentService } from '../services/enrichment.service.js';

export abstract class BaseScraper {
  abstract readonly source: string;

  abstract scrape(): Promise<unknown[]>;
  abstract mapItem(raw: unknown): MappedOpportunity | null;

  async run({ prisma }: CollectorRunOptions): Promise<CollectorResult> {
    const log = await prisma.ingestLog.create({
      data: { source: this.source, status: 'RUNNING' },
    });

    let itemsFound = 0;
    let itemsUpserted = 0;
    let errorMessage: string | undefined;

    try {
      const raws = await this.scrape();
      itemsFound = raws.length;

      for (const raw of raws) {
        const mapped = this.mapItem(raw);
        if (!mapped) continue;

        try {
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
          console.error(`[${this.source}] Failed to upsert ${mapped.sourceUrl}:`, err);
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[scraper:${this.source}] Fatal error:`, err);
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
}

export async function runScrapers(
  scrapers: BaseScraper[],
  prisma: PrismaClient,
): Promise<CollectorResult[]> {
  const results = await Promise.allSettled(scrapers.map((s) => s.run({ prisma })));

  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    const source = scrapers[i].source;
    const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
    console.error(`[scraper:${source}] Unhandled error:`, result.reason);
    return { source, itemsFound: 0, itemsUpserted: 0, error };
  });
}
