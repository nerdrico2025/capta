import type { PrismaClient } from '@prisma/client';
import type { CollectorResult, CollectorRunOptions, MappedOpportunity } from './types.js';
import { enrichmentService } from '../services/enrichment.service.js';
import { computeIsOpen } from '../lib/deadline.js';
import { resolveSourceUrl } from '../lib/link-check.js';
import {
  classificationService,
  gateClassification,
  getMinConfidence,
} from '../services/classification.service.js';

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
  // Guarda de URL: resolve relativo→absoluto (base = portalUrl) e rejeita
  // vazio / não-http antes de persistir (link inválido nunca entra no catálogo).
  const sourceUrl = resolveSourceUrl(item.sourceUrl, item.portalUrl);
  if (!sourceUrl) {
    throw new Error(`sourceUrl inválida (vazia ou não-http): "${item.sourceUrl}"`);
  }

  // submissionDeadline default = deadline legado; isOpen é derivado (item 4).
  const submissionDeadline = item.submissionDeadline ?? item.deadline;
  const isOpen = item.isActive && computeIsOpen(submissionDeadline, item.sourceStatus);

  // Classificação EDITAL_OFICIAL × MATERIA × INDEFINIDO (gate de matéria).
  const cls = await classifyForUpsert(prisma, item, sourceUrl);

  const common = {
    title: item.title,
    deadline: item.deadline,
    submissionDeadline,
    executionDeadline: item.executionDeadline ?? null,
    fundraisingWindowStart: item.fundraisingWindowStart ?? null,
    fundraisingWindowEnd: item.fundraisingWindowEnd ?? null,
    sourceStatus: item.sourceStatus ?? null,
    isOpen,
    classification: cls.classification,
    classificationScore: cls.classificationScore,
    classifiedAt: cls.classifiedAt,
    value: item.value,
    areas: item.areas,
    summary: item.summary,
    pdfUrl: item.pdfUrl ?? null,
    portalUrl: item.portalUrl,
    isActive: item.isActive,
    sourceType: item.sourceType,
  };

  const result = await prisma.opportunity.upsert({
    where: { sourceUrl },
    update: common,
    create: {
      ...common,
      source: item.source,
      type: item.type,
      sourceUrl,
    },
    select: { id: true, aiSummary: true },
  });
  return result;
}

/**
 * Classifica o item para o gate. Reusa a classificação existente (se já houver)
 * para não re-chamar o LLM a cada ingestão. EDITAL_OFICIAL abaixo do limiar é
 * rebaixado a INDEFINIDO (revisão manual). MATERIA/INDEFINIDO não vão ao ar.
 */
async function classifyForUpsert(
  prisma: PrismaClient,
  item: MappedOpportunity,
  sourceUrl: string,
): Promise<{ classification: string; classificationScore: number | null; classifiedAt: Date }> {
  const existing = await prisma.opportunity.findUnique({
    where: { sourceUrl },
    select: { classification: true, classificationScore: true },
  });
  if (existing?.classification) {
    return {
      classification: existing.classification,
      classificationScore: existing.classificationScore,
      classifiedAt: new Date(),
    };
  }

  const result = await classificationService.classifyItem({
    sourceUrl,
    portalUrl: item.portalUrl,
    title: item.title,
    summary: item.summary,
    rawContent: item.rawContent,
    pdfUrl: item.pdfUrl,
    source: item.source,
    sourceType: item.sourceType,
  });

  return {
    classification: gateClassification(result, getMinConfidence()),
    classificationScore: result.score,
    classifiedAt: new Date(),
  };
}
