import type { PrismaClient } from '@prisma/client';
import type { CollectorResult, CollectorRunOptions, MappedOpportunity } from './types.js';
import { enrichmentService } from '../services/enrichment.service.js';
import { computeIsOpen } from '../lib/deadline.js';

export abstract class BaseCollector {
  abstract readonly source: string;

  protected abstract fetchPage(page: number): Promise<{ items: unknown[]; hasMore: boolean }>;
  abstract mapItem(raw: unknown): MappedOpportunity | null;

  async run({ prisma }: CollectorRunOptions): Promise<CollectorResult> {
    const log = await prisma.ingestLog.create({
      data: { source: this.source, status: 'RUNNING' },
    });

    let itemsFound = 0;
    let itemsUpserted = 0;
    let errorMessage: string | undefined;

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { items, hasMore: more } = await this.fetchPage(page);
        hasMore = more;
        page++;

        itemsFound += items.length;

        for (const raw of items) {
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
            // Log item-level errors but keep processing
            console.error(`[${this.source}] Failed to upsert ${mapped.sourceUrl}:`, err);
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
}

export async function upsertOpportunity(
  prisma: PrismaClient,
  item: MappedOpportunity,
): Promise<{ id: string; aiSummary: string | null }> {
  // submissionDeadline default = deadline legado; isOpen é derivado (item 4).
  const submissionDeadline = item.submissionDeadline ?? item.deadline;
  const isOpen = item.isActive && computeIsOpen(submissionDeadline, item.sourceStatus);

  const common = {
    title: item.title,
    deadline: item.deadline,
    submissionDeadline,
    executionDeadline: item.executionDeadline ?? null,
    fundraisingWindowStart: item.fundraisingWindowStart ?? null,
    fundraisingWindowEnd: item.fundraisingWindowEnd ?? null,
    sourceStatus: item.sourceStatus ?? null,
    isOpen,
    value: item.value,
    areas: item.areas,
    summary: item.summary,
    pdfUrl: item.pdfUrl ?? null,
    portalUrl: item.portalUrl,
    isActive: item.isActive,
    sourceType: item.sourceType,
  };

  const result = await prisma.opportunity.upsert({
    where: { sourceUrl: item.sourceUrl },
    update: common,
    create: {
      ...common,
      source: item.source,
      type: item.type,
      sourceUrl: item.sourceUrl,
    },
    select: { id: true, aiSummary: true },
  });
  return result;
}
