import { describe, it, expect } from 'vitest';
import { buildOpenWhere } from '../open-filter.js';

type Rec = {
  isOpen: boolean;
  submissionDeadline: Date | null;
  linkStatus?: string | null;
  classification?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function matchLeaf(leaf: any, rec: Rec): boolean {
  if ('linkStatus' in leaf) {
    const v = leaf.linkStatus;
    if (v === null) return (rec.linkStatus ?? null) === null;
    if (v && typeof v === 'object' && 'not' in v) return (rec.linkStatus ?? null) !== v.not;
  }
  if ('classification' in leaf) {
    const v = leaf.classification;
    if (v === null) return (rec.classification ?? null) === null;
    if (v && typeof v === 'object' && 'notIn' in v) {
      const c = rec.classification ?? null;
      return c !== null && !v.notIn.includes(c);
    }
  }
  return false;
}

/**
 * Avalia o objeto Prisma de buildOpenWhere como predicado JS, exercitando a
 * SEMÂNTICA real (incl. o AND de ORs null-inclusive), não uma cópia hardcoded.
 */
function matchesOpenWhere(where: ReturnType<typeof buildOpenWhere>, rec: Rec): boolean {
  if (where.isOpen !== undefined && rec.isOpen !== where.isOpen) return false;
  const gt = (where.submissionDeadline as { gt?: Date } | undefined)?.gt;
  if (gt && !(rec.submissionDeadline && rec.submissionDeadline.getTime() > gt.getTime())) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const clause of (where.AND as any[] | undefined) ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = (clause.OR as any[]).some((leaf) => matchLeaf(leaf, rec));
    if (!ok) return false;
  }
  return true;
}

describe('buildOpenWhere — filtro duro', () => {
  const now = new Date('2026-06-23T12:00:00.000Z');
  const future = new Date('2026-12-01T00:00:00.000Z');
  const past = new Date('2026-01-01T00:00:00.000Z');
  const open = { isOpen: true, submissionDeadline: future } as const;

  it('exige isOpen, prazo futuro, e exclui REQUIRES_AUTH / MATERIA / INDEFINIDO', () => {
    expect(buildOpenWhere(now)).toEqual({
      isOpen: true,
      submissionDeadline: { gt: now },
      AND: [
        { OR: [{ linkStatus: null }, { linkStatus: { not: 'REQUIRES_AUTH' } }] },
        {
          OR: [{ classification: null }, { classification: { notIn: ['MATERIA', 'INDEFINIDO'] } }],
        },
      ],
    });
  });

  it('serve EDITAL_OFICIAL com link OK', () => {
    expect(
      matchesOpenWhere(buildOpenWhere(now), {
        ...open,
        classification: 'EDITAL_OFICIAL',
        linkStatus: 'OK',
      }),
    ).toBe(true);
  });

  it('serve registro legado/não-checado (classification null, linkStatus null)', () => {
    expect(
      matchesOpenWhere(buildOpenWhere(now), { ...open, classification: null, linkStatus: null }),
    ).toBe(true);
  });

  it('NUNCA serve EXIGE_LOGIN (linkStatus=REQUIRES_AUTH)', () => {
    expect(matchesOpenWhere(buildOpenWhere(now), { ...open, linkStatus: 'REQUIRES_AUTH' })).toBe(
      false,
    );
  });

  it('NUNCA serve MATERIA nem INDEFINIDO', () => {
    expect(matchesOpenWhere(buildOpenWhere(now), { ...open, classification: 'MATERIA' })).toBe(
      false,
    );
    expect(matchesOpenWhere(buildOpenWhere(now), { ...open, classification: 'INDEFINIDO' })).toBe(
      false,
    );
  });

  it('NUNCA serve isOpen=false, prazo vencido ou sem prazo', () => {
    expect(
      matchesOpenWhere(buildOpenWhere(now), { isOpen: false, submissionDeadline: future }),
    ).toBe(false);
    expect(matchesOpenWhere(buildOpenWhere(now), { isOpen: true, submissionDeadline: past })).toBe(
      false,
    );
    expect(matchesOpenWhere(buildOpenWhere(now), { isOpen: true, submissionDeadline: null })).toBe(
      false,
    );
  });
});
