import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { enrichmentService } from '../services/enrichment.service.js';
import { runIngestJob } from '../cron/ingest.job.js';
import { computeQualityMetrics } from '../lib/quality-metrics.js';

const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'dev-admin-key';

function requireAdminKey(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  // Aceita tanto "x-admin-key: <key>" quanto "Authorization: Bearer <key>"
  const xKey = req.headers['x-admin-key'];
  if (xKey === ADMIN_KEY) return true;
  const auth = req.headers['authorization'];
  return auth === `Bearer ${ADMIN_KEY}`;
}

export async function adminRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // POST /admin/opportunities/:id/enrich
  f.post(
    '/opportunities/:id/enrich',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Re-enrich a single opportunity with AI',
        params: z.object({ id: z.string() }),
        querystring: z.object({ force: z.coerce.boolean().default(false) }),
        response: {
          200: z.object({
            id: z.string(),
            aiSummary: z.string().nullable(),
            eligibleOrgProfile: z.string().nullable(),
            firstSteps: z.array(z.string()),
          }),
          401: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      if (!requireAdminKey(req)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { force } = req.query;

      const opp = await app.prisma.opportunity.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          source: true,
          areas: true,
          summary: true,
          aiSummary: true,
        },
      });

      if (!opp) {
        return reply.status(404).send({ error: 'Opportunity not found' });
      }

      await enrichmentService.enrichOpportunity(
        app.prisma,
        opp.id,
        {
          title: opp.title,
          source: opp.source,
          areas: opp.areas,
          rawDescription: opp.summary,
        },
        force,
      );

      const updated = await app.prisma.opportunity.findUniqueOrThrow({
        where: { id },
        select: { id: true, aiSummary: true, eligibleOrgProfile: true, firstSteps: true },
      });

      return reply.send(updated);
    },
  );

  // GET /admin/health — data quality dashboard ─────────────────────────────
  f.get(
    '/health',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Dashboard de qualidade de dados',
        response: {
          200: z.object({
            generatedAt: z.string(),
            opportunities: z.object({
              totalActive: z.number(),
              expiringSoon: z.number(),
              stale: z.number(),
              missingAiSummary: z.number(),
            }),
            dataAlerts: z.object({
              open: z.number(),
              byType: z.record(z.string(), z.number()),
            }),
            ingest: z.object({
              last7Days: z.array(
                z.object({
                  source: z.string(),
                  status: z.string(),
                  itemsFound: z.number(),
                  itemsUpserted: z.number(),
                  startedAt: z.string(),
                }),
              ),
              successRateBySource: z.record(
                z.string(),
                z.object({
                  total: z.number(),
                  success: z.number(),
                  rate: z.number(),
                }),
              ),
            }),
          }),
          401: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      if (!requireAdminKey(req)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [totalActive, expiringSoon, stale, missingAiSummary, openAlerts, ingestLogs] =
        await Promise.all([
          app.prisma.opportunity.count({ where: { isActive: true } }),
          app.prisma.opportunity.count({
            where: { isActive: true, deadline: { gte: now, lte: sevenDaysFromNow } },
          }),
          app.prisma.opportunity.count({
            where: { isActive: true, updatedAt: { lt: fifteenDaysAgo } },
          }),
          app.prisma.opportunity.count({ where: { isActive: true, aiSummary: null } }),
          app.prisma.dataAlert.findMany({
            where: { resolvedAt: null },
            select: { type: true },
          }),
          app.prisma.ingestLog.findMany({
            where: { startedAt: { gte: sevenDaysAgo } },
            select: {
              source: true,
              status: true,
              itemsFound: true,
              itemsUpserted: true,
              startedAt: true,
            },
            orderBy: { startedAt: 'desc' },
          }),
        ]);

      // Aggregate alert counts by type
      const byType: Record<string, number> = {};
      for (const a of openAlerts) {
        byType[a.type] = (byType[a.type] ?? 0) + 1;
      }

      // Aggregate ingest success rate by source
      const successRateBySource: Record<string, { total: number; success: number; rate: number }> =
        {};
      for (const log of ingestLogs) {
        if (!successRateBySource[log.source]) {
          successRateBySource[log.source] = { total: 0, success: 0, rate: 0 };
        }
        successRateBySource[log.source].total++;
        if (log.status === 'SUCCESS') successRateBySource[log.source].success++;
      }
      for (const src of Object.values(successRateBySource)) {
        src.rate = src.total > 0 ? Math.round((src.success / src.total) * 100) : 0;
      }

      return reply.send({
        generatedAt: now.toISOString(),
        opportunities: { totalActive, expiringSoon, stale, missingAiSummary },
        dataAlerts: { open: openAlerts.length, byType },
        ingest: {
          last7Days: ingestLogs.map((l) => ({ ...l, startedAt: l.startedAt.toISOString() })),
          successRateBySource,
        },
      });
    },
  );

  // GET /admin/quality — métricas de saúde do catálogo ─────────────────────
  f.get(
    '/quality',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Métricas de qualidade/saúde do catálogo',
        response: {
          200: z.object({
            generatedAt: z.string(),
            opportunities: z.object({
              total: z.number(),
              active: z.number(),
              servable: z.number(),
            }),
            dataAlertsByType: z.record(z.string(), z.number()),
            links: z.object({
              checked: z.number(),
              ok: z.number(),
              activeRate: z.number(),
            }),
            avgUpdateLagHours: z.number(),
            regressionLeak: z.number(),
          }),
          401: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      if (!requireAdminKey(req)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      const metrics = await computeQualityMetrics(app.prisma);
      return reply.send(metrics);
    },
  );

  // POST /admin/ingest — trigger ingest job manually
  f.post(
    '/ingest',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Trigger ingest job manually (fire-and-forget)',
        response: {
          200: z.object({ started: z.boolean(), message: z.string() }),
          401: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      if (!requireAdminKey(req)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      void runIngestJob(app.prisma);

      return reply.send({ started: true, message: 'Ingest job started in background' });
    },
  );

  // POST /admin/opportunities/enrich-pending — alias for enrich-all (canonical name)
  f.post(
    '/opportunities/enrich-pending',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Enrich all opportunities missing AI summary (canonical endpoint)',
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(500).default(50) }),
        response: {
          200: z.object({ queued: z.number() }),
          401: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      if (!requireAdminKey(req)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { limit } = req.query;

      const opps = await app.prisma.opportunity.findMany({
        where: { aiSummary: null, isActive: true },
        select: { id: true, title: true, source: true, areas: true, summary: true },
        take: limit,
      });

      for (const opp of opps) {
        void enrichmentService.enrichOpportunity(app.prisma, opp.id, {
          title: opp.title,
          source: opp.source,
          areas: opp.areas,
          rawDescription: opp.summary,
        });
      }

      return reply.send({ queued: opps.length });
    },
  );

  // POST /admin/opportunities/enrich-all — bulk re-enrich unenriched opportunities
  f.post(
    '/opportunities/enrich-all',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Enrich all opportunities missing AI summary',
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(500).default(50) }),
        response: {
          200: z.object({ queued: z.number() }),
          401: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      if (!requireAdminKey(req)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { limit } = req.query;

      const opps = await app.prisma.opportunity.findMany({
        where: { aiSummary: null, isActive: true },
        select: { id: true, title: true, source: true, areas: true, summary: true },
        take: limit,
      });

      // Fire-and-forget: queue enrichment without blocking the response
      for (const opp of opps) {
        void enrichmentService.enrichOpportunity(app.prisma, opp.id, {
          title: opp.title,
          source: opp.source,
          areas: opp.areas,
          rawDescription: opp.summary,
        });
      }

      return reply.send({ queued: opps.length });
    },
  );
}
