/**
 * open-filter.ts — FILTRO DURO único e reutilizável.
 *
 * Nenhuma rota de leitura pública deve servir registros encerrados. Em vez de
 * espalhar `isActive: true` pelas rotas, todo ponto de leitura compõe este
 * fragmento. Cinto-e-suspensório: confia no `isOpen` persistido (mantido pela
 * ingestão e pelo job de revalidação) E reforça `submissionDeadline > now` em
 * tempo de query, pegando registros que viraram entre execuções do job.
 */
import type { Prisma } from '@prisma/client';

export function buildOpenWhere(now: Date = new Date()): Prisma.OpportunityWhereInput {
  return {
    isOpen: true,
    submissionDeadline: { gt: now },
    // Suprime cards atrás de parede de login. O `not` do Prisma é null-inclusive,
    // então itens ainda não checados (linkStatus null) ou OK continuam aparecendo.
    linkStatus: { not: 'REQUIRES_AUTH' },
  };
}
