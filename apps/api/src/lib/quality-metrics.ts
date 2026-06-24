/**
 * quality-metrics.ts — métricas de saúde do catálogo para GET /admin/quality.
 * Função pura sobre o Prisma (testável com mock).
 */
import type { PrismaClient } from '@prisma/client';
import { buildOpenWhere } from './open-filter.js';

export interface QualityMetrics {
  generatedAt: string;
  opportunities: { total: number; active: number; servable: number };
  dataAlertsByType: Record<string, number>;
  links: { checked: number; ok: number; activeRate: number };
  avgUpdateLagHours: number;
  /** isOpen=false que passariam pelo filtro nas últimas 24h — deve ser 0 (regressão). */
  regressionLeak: number;
}

export async function computeQualityMetrics(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<QualityMetrics> {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [total, active, servable, linksChecked, linksOk, regressionLeak, alertGroups, updatedRows] =
    await Promise.all([
      prisma.opportunity.count(),
      prisma.opportunity.count({ where: { isActive: true } }),
      prisma.opportunity.count({ where: buildOpenWhere(now) }),
      prisma.opportunity.count({ where: { linkCheckedAt: { not: null } } }),
      prisma.opportunity.count({ where: { linkStatus: 'OK' } }),
      prisma.opportunity.count({
        where: { AND: [buildOpenWhere(now), { isOpen: false }, { updatedAt: { gte: dayAgo } }] },
      }),
      prisma.dataAlert.groupBy({
        by: ['type'],
        where: { resolvedAt: null },
        _count: { _all: true },
      }),
      prisma.opportunity.findMany({ where: { isActive: true }, select: { updatedAt: true } }),
    ]);

  const dataAlertsByType: Record<string, number> = {};
  for (const g of alertGroups) dataAlertsByType[g.type] = g._count._all;

  const avgUpdateLagHours =
    updatedRows.length > 0
      ? Number(
          (
            updatedRows.reduce((acc, r) => acc + (now.getTime() - r.updatedAt.getTime()), 0) /
            updatedRows.length /
            3_600_000
          ).toFixed(1),
        )
      : 0;

  return {
    generatedAt: now.toISOString(),
    opportunities: { total, active, servable },
    dataAlertsByType,
    links: {
      checked: linksChecked,
      ok: linksOk,
      activeRate: linksChecked > 0 ? Number((linksOk / linksChecked).toFixed(3)) : 0,
    },
    avgUpdateLagHours,
    regressionLeak,
  };
}
