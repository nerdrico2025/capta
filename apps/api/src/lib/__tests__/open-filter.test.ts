import { describe, it, expect } from 'vitest';
import { buildOpenWhere } from '../open-filter.js';

/**
 * Interpreta o objeto Prisma retornado por buildOpenWhere como predicado JS,
 * exercitando a SEMÂNTICA real do filtro (não uma cópia hardcoded).
 */
function matchesOpenWhere(
  where: ReturnType<typeof buildOpenWhere>,
  rec: { isOpen: boolean; submissionDeadline: Date | null },
): boolean {
  if (where.isOpen !== undefined && rec.isOpen !== where.isOpen) return false;
  const gt = (where.submissionDeadline as { gt?: Date } | undefined)?.gt;
  if (gt && !(rec.submissionDeadline && rec.submissionDeadline.getTime() > gt.getTime())) {
    return false;
  }
  return true;
}

describe('buildOpenWhere — filtro duro', () => {
  const now = new Date('2026-06-23T12:00:00.000Z');
  const future = new Date('2026-12-01T00:00:00.000Z');
  const past = new Date('2026-01-01T00:00:00.000Z');

  it('exige isOpen=true E submissionDeadline > now', () => {
    expect(buildOpenWhere(now)).toEqual({
      isOpen: true,
      submissionDeadline: { gt: now },
    });
  });

  it('serve registro aberto com prazo futuro', () => {
    expect(
      matchesOpenWhere(buildOpenWhere(now), { isOpen: true, submissionDeadline: future }),
    ).toBe(true);
  });

  it('NUNCA serve registro com isOpen=false (mesmo com prazo futuro)', () => {
    expect(
      matchesOpenWhere(buildOpenWhere(now), { isOpen: false, submissionDeadline: future }),
    ).toBe(false);
  });

  it('NUNCA serve registro com prazo vencido (mesmo isOpen=true, defesa em profundidade)', () => {
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
