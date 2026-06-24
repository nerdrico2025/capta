import { describe, it, expect } from 'vitest';
import { buildOpenWhere } from '../open-filter.js';

type Rec = { isOpen: boolean; submissionDeadline: Date | null; linkStatus?: string | null };

/**
 * Interpreta o objeto Prisma retornado por buildOpenWhere como predicado JS,
 * exercitando a SEMÂNTICA real do filtro (não uma cópia hardcoded). O `not` do
 * Prisma é null-inclusive, então linkStatus null/ausente passa.
 */
function matchesOpenWhere(where: ReturnType<typeof buildOpenWhere>, rec: Rec): boolean {
  if (where.isOpen !== undefined && rec.isOpen !== where.isOpen) return false;
  const gt = (where.submissionDeadline as { gt?: Date } | undefined)?.gt;
  if (gt && !(rec.submissionDeadline && rec.submissionDeadline.getTime() > gt.getTime())) {
    return false;
  }
  const notLink = (where.linkStatus as { not?: string } | undefined)?.not;
  if (notLink && (rec.linkStatus ?? null) === notLink) return false;
  return true;
}

describe('buildOpenWhere — filtro duro', () => {
  const now = new Date('2026-06-23T12:00:00.000Z');
  const future = new Date('2026-12-01T00:00:00.000Z');
  const past = new Date('2026-01-01T00:00:00.000Z');

  it('exige isOpen=true, submissionDeadline > now e exclui REQUIRES_AUTH', () => {
    expect(buildOpenWhere(now)).toEqual({
      isOpen: true,
      submissionDeadline: { gt: now },
      linkStatus: { not: 'REQUIRES_AUTH' },
    });
  });

  it('serve registro aberto com prazo futuro e link OK', () => {
    expect(
      matchesOpenWhere(buildOpenWhere(now), {
        isOpen: true,
        submissionDeadline: future,
        linkStatus: 'OK',
      }),
    ).toBe(true);
  });

  it('serve registro ainda não checado (linkStatus null)', () => {
    expect(
      matchesOpenWhere(buildOpenWhere(now), {
        isOpen: true,
        submissionDeadline: future,
        linkStatus: null,
      }),
    ).toBe(true);
  });

  it('NUNCA serve registro EXIGE_LOGIN (linkStatus=REQUIRES_AUTH)', () => {
    expect(
      matchesOpenWhere(buildOpenWhere(now), {
        isOpen: true,
        submissionDeadline: future,
        linkStatus: 'REQUIRES_AUTH',
      }),
    ).toBe(false);
  });

  it('NUNCA serve registro com isOpen=false (mesmo com prazo futuro)', () => {
    expect(
      matchesOpenWhere(buildOpenWhere(now), { isOpen: false, submissionDeadline: future }),
    ).toBe(false);
  });

  it('NUNCA serve registro com prazo vencido (defesa em profundidade)', () => {
    expect(matchesOpenWhere(buildOpenWhere(now), { isOpen: true, submissionDeadline: past })).toBe(
      false,
    );
  });

  it('NUNCA serve registro sem prazo de submissão', () => {
    expect(matchesOpenWhere(buildOpenWhere(now), { isOpen: true, submissionDeadline: null })).toBe(
      false,
    );
  });
});
