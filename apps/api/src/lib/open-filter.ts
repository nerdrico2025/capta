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
  // IMPORTANTE: `not`/`notIn` do Prisma NÃO incluem linhas null (NULL <> x → NULL).
  // Para manter servíveis os registros ainda não checados (linkStatus null) e os
  // legados (classification null), excluímos explicitamente via OR com null.
  // Usamos `AND` (não `OR` top-level) para não colidir com o `OR` da busca textual.
  return {
    isOpen: true,
    submissionDeadline: { gt: now },
    AND: [
      // Suprime parede de login; null (não checado) e OK seguem servíveis.
      { OR: [{ linkStatus: null }, { linkStatus: { not: 'REQUIRES_AUTH' } }] },
      // Só editais oficiais; MATERIA/INDEFINIDO ficam fora. null (legado) servível.
      {
        OR: [{ classification: null }, { classification: { notIn: ['MATERIA', 'INDEFINIDO'] } }],
      },
    ],
  };
}
