import { describe, it, expect, vi } from 'vitest';
import { computeQualityMetrics } from '../quality-metrics.js';

describe('computeQualityMetrics — métricas de saúde (mock Prisma)', () => {
  it('agrega as métricas esperadas', async () => {
    const now = new Date('2026-06-24T12:00:00.000Z');

    // Ordem dos counts = ordem do Promise.all:
    // total, active, servable, linksChecked, linksOk, regressionLeak
    const count = vi
      .fn()
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(45)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(24)
      .mockResolvedValueOnce(0);

    const groupBy = vi.fn().mockResolvedValue([
      { type: 'SCRAPE_FAILED', _count: { _all: 3 } },
      { type: 'LINK_REQUIRES_AUTH', _count: { _all: 1 } },
    ]);

    const findMany = vi
      .fn()
      .mockResolvedValue([
        { updatedAt: new Date(now.getTime() - 2 * 3_600_000) },
        { updatedAt: new Date(now.getTime() - 4 * 3_600_000) },
      ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = { opportunity: { count, findMany }, dataAlert: { groupBy } } as any;

    const m = await computeQualityMetrics(prisma, now);

    expect(m.opportunities).toEqual({ total: 50, active: 45, servable: 40 });
    expect(m.dataAlertsByType).toEqual({ SCRAPE_FAILED: 3, LINK_REQUIRES_AUTH: 1 });
    expect(m.links).toEqual({ checked: 30, ok: 24, activeRate: 0.8 });
    expect(m.avgUpdateLagHours).toBe(3);
    expect(m.regressionLeak).toBe(0); // métrica de regressão: nunca vaza isOpen=false
    expect(m.generatedAt).toBe(now.toISOString());
  });

  it('lida com catálogo vazio (sem divisão por zero)', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const groupBy = vi.fn().mockResolvedValue([]);
    const findMany = vi.fn().mockResolvedValue([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = { opportunity: { count, findMany }, dataAlert: { groupBy } } as any;

    const m = await computeQualityMetrics(prisma, new Date());
    expect(m.links.activeRate).toBe(0);
    expect(m.avgUpdateLagHours).toBe(0);
    expect(m.dataAlertsByType).toEqual({});
  });
});
