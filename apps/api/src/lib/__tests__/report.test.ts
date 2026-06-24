import { describe, it, expect, vi } from 'vitest';
import { recordOpportunityReport, REPORT_REASON_TO_ALERT, type ReportReason } from '../report.js';

function makeFakePrisma(exists: boolean) {
  const findUnique = vi.fn(async () => (exists ? { id: 'o1' } : null));
  const create = vi.fn(async () => ({}));
  const update = vi.fn(async () => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = { opportunity: { findUnique, update }, dataAlert: { create } } as any;
  return { prisma, findUnique, create, update };
}

describe('recordOpportunityReport', () => {
  it('retorna ok=false quando a oportunidade não existe (sem criar alerta)', async () => {
    const { prisma, create } = makeFakePrisma(false);
    const r = await recordOpportunityReport(prisma, 'inexistente', 'EXPIRED');
    expect(r.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  const reasons: ReportReason[] = ['EXPIRED', 'LINK_BROKEN', 'NOT_AN_EDITAL'];
  for (const reason of reasons) {
    it(`cria DataAlert ${REPORT_REASON_TO_ALERT[reason]} e força recheck para ${reason}`, async () => {
      const { prisma, create, update } = makeFakePrisma(true);
      const r = await recordOpportunityReport(prisma, 'o1', reason);

      expect(r).toEqual({ ok: true, type: REPORT_REASON_TO_ALERT[reason] });
      expect(create).toHaveBeenCalledWith({
        data: {
          opportunityId: 'o1',
          type: REPORT_REASON_TO_ALERT[reason],
          message: expect.stringContaining(reason),
        },
      });
      expect(update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { linkCheckedAt: null },
      });
    });
  }
});
