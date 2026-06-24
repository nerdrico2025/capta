/**
 * revalidation.job.ts — recheca registros ABERTOS contra a fonte e marca os
 * encerrados. Cadência por tipo de fonte (item 6):
 *   - sourceType="api"     → diário
 *   - sourceType="scraper" → semanal
 *
 * Dois critérios de fechamento:
 *   1. Prazo: submissionDeadline já passou (determinístico).
 *   2. Fonte: sourceUrl retorna 404/410 (recurso removido). Erros de rede
 *      transitórios NÃO fecham, para evitar falso positivo.
 */
import type { PrismaClient } from '@prisma/client';

const HTTP_TIMEOUT_MS = 8_000;
const MAX_PER_RUN = 200;

export interface RevalidationResult {
  sourceType: 'api' | 'scraper';
  closedByDeadline: number;
  checkedHttp: number;
  closedBySource: number;
  errors: string[];
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function closeOpportunity(prisma: PrismaClient, id: string, reason: string): Promise<void> {
  await prisma.opportunity.update({
    where: { id },
    data: { isOpen: false, isActive: false, sourceStatus: reason },
  });
}

export async function runRevalidationJob(
  prisma: PrismaClient,
  sourceType: 'api' | 'scraper',
  now: Date = new Date(),
): Promise<RevalidationResult> {
  const result: RevalidationResult = {
    sourceType,
    closedByDeadline: 0,
    checkedHttp: 0,
    closedBySource: 0,
    errors: [],
  };

  // 1. Fecha por prazo: abertos cujo submissionDeadline já passou.
  try {
    const { count } = await prisma.opportunity.updateMany({
      where: { isOpen: true, sourceType, submissionDeadline: { lte: now } },
      data: { isOpen: false, isActive: false },
    });
    result.closedByDeadline = count;
  } catch (err) {
    result.errors.push(`deadline: ${msg(err)}`);
  }

  // 2. Recheca a fonte (HTTP HEAD) dos que continuam abertos.
  let open: Array<{ id: string; sourceUrl: string }> = [];
  try {
    open = await prisma.opportunity.findMany({
      where: { isOpen: true, sourceType },
      select: { id: true, sourceUrl: true },
      take: MAX_PER_RUN,
    });
  } catch (err) {
    result.errors.push(`fetch: ${msg(err)}`);
    return result;
  }

  await Promise.allSettled(
    open.map(async (opp) => {
      if (!opp.sourceUrl.startsWith('http')) return; // âncora interna — ignora
      result.checkedHttp++;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
        const res = await fetch(opp.sourceUrl, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'CaptaBot/1.0 (+https://capta.app)' },
        });
        clearTimeout(timeout);

        if (res.status === 404 || res.status === 410) {
          await closeOpportunity(prisma, opp.id, `Fonte retornou HTTP ${res.status}`);
          result.closedBySource++;
        }
      } catch {
        // erro de rede/timeout — transitório, não fecha
      }
    }),
  );

  return result;
}
