import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { calculateCompatibility } from '../services/compatibility.service.js';

// ─── Shared schemas ───────────────────────────────────────────────────────────

const CNPJ_RE = /^\d{14}$/;

const OrgHeader = z.object({ 'x-org-cnpj': z.string().regex(CNPJ_RE, 'CNPJ must be 14 digits') });
const OptionalOrgHeader = z.object({ 'x-org-cnpj': z.string().regex(CNPJ_RE).optional() });

const CompatibilityResult = z
  .object({
    score: z.number().int().min(0).max(100),
    level: z.enum(['ALTO', 'MEDIO', 'BAIXO']),
    reasons: z.array(z.string()),
  })
  .nullable();

const OpportunityListItem = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  type: z.string(),
  deadline: z.string(),
  value: z.number().nullable(),
  areas: z.array(z.string()),
  summary: z.string(),
  createdAt: z.string(),
  compatibility: CompatibilityResult,
});

const OpportunityDetail = OpportunityListItem.extend({
  sourceUrl: z.string(),
  pdfUrl: z.string().nullable(),
  portalUrl: z.string(),
  isActive: z.boolean(),
  deadline: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const PaginationMeta = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  pages: z.number(),
});

const ErrorSchema = z.object({ error: z.string(), message: z.string().optional() });

// ─── Query schemas ────────────────────────────────────────────────────────────

const ListQuery = z.object({
  area: z.string().optional().describe('Áreas separadas por vírgula (ex: cultura,educacao)'),
  type: z.enum(['edital', 'lei', 'privado']).optional(),
  deadline: z.enum(['asc', 'desc']).default('asc').describe('Ordenação por prazo'),
  search: z.string().optional().describe('Busca em título e resumo'),
  source: z.string().optional().describe('Filtrar por fonte exata (ex: FINEP)'),
  source_exclude: z.string().optional().describe('Excluir fonte (ex: SALIC)'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const SavedListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LIST_SELECT = {
  id: true,
  title: true,
  source: true,
  type: true,
  deadline: true,
  value: true,
  areas: true,
  summary: true,
  aiSummary: true,
  createdAt: true,
  scope: true,
  scopeLocation: true,
  targetSizes: true,
} as const;

type ListRow = {
  id: string;
  title: string;
  source: string;
  type: string;
  deadline: Date;
  value: Prisma.Decimal | null;
  areas: string[];
  summary: string;
  aiSummary: string | null;
  createdAt: Date;
  scope: string;
  scopeLocation: string | null;
  targetSizes: string[];
};

function toListItem(opp: ListRow, compatibility: z.infer<typeof CompatibilityResult>) {
  return {
    id: opp.id,
    title: opp.title,
    source: opp.source,
    type: opp.type,
    deadline: opp.deadline.toISOString(),
    value: opp.value ? Number(opp.value) : null,
    areas: opp.areas,
    summary: opp.aiSummary ?? opp.summary,
    createdAt: opp.createdAt.toISOString(),
    compatibility,
  };
}

function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, '');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function opportunityRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /opportunities/saved ─────────────────────────────────────────────
  f.get(
    '/saved',
    {
      schema: {
        tags: ['Opportunities'],
        summary: 'Listar oportunidades salvas pela organização',
        security: [{ OrgCnpj: [] }],
        headers: OrgHeader,
        querystring: SavedListQuery,
        response: {
          200: z.object({
            data: z.array(OpportunityListItem),
            meta: PaginationMeta,
          }),
          404: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const cnpj = req.headers['x-org-cnpj'];
      const { page, limit } = req.query;

      const org = await app.prisma.organization.findUnique({ where: { cnpj } });
      if (!org) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      const [rows, total] = await app.prisma.$transaction([
        app.prisma.savedOpportunity.findMany({
          where: { organizationId: org.id },
          include: { opportunity: { select: LIST_SELECT } },
          orderBy: { savedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        app.prisma.savedOpportunity.count({ where: { organizationId: org.id } }),
      ]);

      return reply.send({
        data: rows.map((r) =>
          toListItem(r.opportunity as ListRow, calculateCompatibility(org, r.opportunity as any)),
        ),
        meta: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    },
  );

  // ── GET /opportunities ───────────────────────────────────────────────────
  f.get(
    '/',
    {
      schema: {
        tags: ['Opportunities'],
        summary: 'Listar oportunidades com filtros e paginação',
        headers: OptionalOrgHeader,
        querystring: ListQuery,
        response: {
          200: z.object({
            data: z.array(OpportunityListItem),
            meta: PaginationMeta,
          }),
        },
      },
    },
    async (req, reply) => {
      const { area, type, deadline, search, source, source_exclude, page, limit } = req.query;
      const rawCnpj = req.headers['x-org-cnpj'];

      const areas = area
        ? area
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean)
        : undefined;

      const sourceFilter: Prisma.StringFilter | string | undefined = source
        ? source
        : source_exclude
          ? { not: source_exclude }
          : undefined;

      const where: Prisma.OpportunityWhereInput = {
        isActive: true,
        ...(sourceFilter !== undefined && { source: sourceFilter }),
        ...(areas?.length && { areas: { hasSome: areas } }),
        ...(type && { type: type.toUpperCase() as Prisma.EnumOpportunityTypeFilter }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { summary: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }),
      };

      const [[items, total], org] = await Promise.all([
        app.prisma.$transaction([
          app.prisma.opportunity.findMany({
            where,
            select: LIST_SELECT,
            orderBy: { deadline: deadline },
            skip: (page - 1) * limit,
            take: limit,
          }),
          app.prisma.opportunity.count({ where }),
        ]),
        rawCnpj
          ? app.prisma.organization.findUnique({ where: { cnpj: normalizeCnpj(rawCnpj) } })
          : Promise.resolve(null),
      ]);

      return reply.send({
        data: items.map((opp) =>
          toListItem(opp as ListRow, org ? calculateCompatibility(org, opp as any) : null),
        ),
        meta: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    },
  );

  // ── POST /opportunities/submit ───────────────────────────────────────────
  // Must be registered BEFORE /:id so "submit" wins the router match on POST
  f.post(
    '/submit',
    {
      schema: {
        tags: ['Opportunities'],
        summary: 'Submeter edital privado para revisão (institutos e fundações)',
        body: z.object({
          instituteName: z.string().min(3),
          instituteCnpj: z.string().regex(/^\d{14}$/, 'CNPJ must be 14 digits'),
          title: z.string().min(5),
          areas: z.array(z.string()).min(1),
          deadline: z.string(),
          value: z.number().positive(),
          currency: z.enum(['BRL', 'USD']),
          officialLink: z.string().url(),
          portalLink: z.string().url().optional(),
          description: z.string().min(200),
          pdfFileName: z.string().optional(),
        }),
        response: {
          201: z.object({ id: z.string(), message: z.string() }),
          409: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const {
        instituteName,
        title,
        areas,
        deadline,
        value,
        currency,
        officialLink,
        portalLink,
        description,
      } = req.body;

      const existing = await app.prisma.opportunity.findUnique({
        where: { sourceUrl: officialLink },
      });
      if (existing) {
        return reply
          .status(409)
          .send({ error: 'Duplicate', message: 'Este edital já foi cadastrado.' });
      }

      const valueInBRL = currency === 'USD' ? Math.round(value * 5.5 * 100) / 100 : value;

      const opp = await app.prisma.opportunity.create({
        data: {
          title,
          source: instituteName,
          type: 'PRIVADO',
          sourceType: 'manual',
          sourceUrl: officialLink,
          deadline: new Date(deadline),
          value: valueInBRL,
          areas,
          summary: description.slice(0, 500),
          portalUrl: portalLink ?? officialLink,
          isActive: false,
        },
        select: { id: true },
      });

      return reply
        .status(201)
        .send({ id: opp.id, message: 'Seu edital será revisado em até 48h.' });
    },
  );

  // ── GET /opportunities/:id/compatibility ─────────────────────────────────
  f.get(
    '/:id/compatibility',
    {
      schema: {
        tags: ['Opportunities'],
        summary: 'Calcular compatibilidade entre organização e edital',
        params: z.object({ id: z.string() }),
        querystring: z.object({
          cnpj: z.string().describe('CNPJ da organização (com ou sem formatação)'),
        }),
        response: {
          200: z.object({
            opportunityId: z.string(),
            cnpj: z.string(),
            score: z.number(),
            level: z.enum(['ALTO', 'MEDIO', 'BAIXO']),
            reasons: z.array(z.string()),
          }),
          404: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const cnpj = normalizeCnpj(req.query.cnpj);

      if (!CNPJ_RE.test(cnpj)) {
        return reply
          .status(400)
          .send({ error: 'CNPJ inválido', message: 'CNPJ deve conter 14 dígitos' });
      }

      const [opp, org] = await Promise.all([
        app.prisma.opportunity.findUnique({
          where: { id },
          select: { id: true, areas: true, scope: true, scopeLocation: true, targetSizes: true },
        }),
        app.prisma.organization.findUnique({ where: { cnpj } }),
      ]);

      if (!opp) return reply.status(404).send({ error: 'Opportunity not found' });
      if (!org) return reply.status(404).send({ error: 'Organization not found' });

      const result = calculateCompatibility(org, opp);

      return reply.send({
        opportunityId: opp.id,
        cnpj: org.cnpj,
        ...result,
      });
    },
  );

  // ── GET /opportunities/:id ───────────────────────────────────────────────
  f.get(
    '/:id',
    {
      schema: {
        tags: ['Opportunities'],
        summary: 'Detalhe de uma oportunidade',
        params: z.object({ id: z.string() }),
        headers: OptionalOrgHeader,
        response: {
          200: OpportunityDetail,
          404: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const rawCnpj = req.headers['x-org-cnpj'];

      const [opp, org] = await Promise.all([
        app.prisma.opportunity.findUnique({ where: { id: req.params.id } }),
        rawCnpj
          ? app.prisma.organization.findUnique({ where: { cnpj: normalizeCnpj(rawCnpj) } })
          : Promise.resolve(null),
      ]);

      if (!opp) {
        return reply.status(404).send({ error: 'Opportunity not found' });
      }

      return reply.send({
        ...opp,
        summary: opp.aiSummary ?? opp.summary,
        value: opp.value ? Number(opp.value) : null,
        compatibility: org ? calculateCompatibility(org, opp) : null,
      });
    },
  );

  // ── POST /opportunities/:id/save ─────────────────────────────────────────
  f.post(
    '/:id/save',
    {
      schema: {
        tags: ['Opportunities'],
        summary: 'Salvar uma oportunidade para a organização',
        security: [{ OrgCnpj: [] }],
        params: z.object({ id: z.string() }),
        headers: OrgHeader,
        response: {
          201: z.object({ id: z.string(), savedAt: z.coerce.date() }),
          404: ErrorSchema,
          409: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const cnpj = req.headers['x-org-cnpj'];
      const opportunityId = req.params.id;

      const [org, opportunity] = await Promise.all([
        app.prisma.organization.findUnique({ where: { cnpj } }),
        app.prisma.opportunity.findUnique({ where: { id: opportunityId } }),
      ]);

      if (!org) return reply.status(404).send({ error: 'Organization not found' });
      if (!opportunity) return reply.status(404).send({ error: 'Opportunity not found' });

      const existing = await app.prisma.savedOpportunity.findUnique({
        where: { organizationId_opportunityId: { organizationId: org.id, opportunityId } },
      });

      if (existing) {
        return reply.status(409).send({
          error: 'Already saved',
          message: 'This opportunity is already saved for this organization',
        });
      }

      const saved = await app.prisma.savedOpportunity.create({
        data: { organizationId: org.id, opportunityId },
      });

      return reply.status(201).send({ id: saved.id, savedAt: saved.savedAt });
    },
  );

  // ── PATCH /opportunities/:id/deactivate ──────────────────────────────────
  f.patch(
    '/:id/deactivate',
    {
      schema: {
        tags: ['Opportunities'],
        summary: 'Desativar uma oportunidade',
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ id: z.string(), isActive: z.boolean() }),
          404: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const opp = await app.prisma.opportunity.findUnique({ where: { id: req.params.id } });
      if (!opp) return reply.status(404).send({ error: 'Opportunity not found' });

      const updated = await app.prisma.opportunity.update({
        where: { id: req.params.id },
        data: { isActive: false },
        select: { id: true, isActive: true },
      });

      return reply.send(updated);
    },
  );
}
