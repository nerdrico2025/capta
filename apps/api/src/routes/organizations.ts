import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { fetchOscProfile } from '../services/osc.service.js';

// ─── Shared schemas ───────────────────────────────────────────────────────────

const CNPJ_RE = /^\d{14}$/;

const OscProfileSchema = z.object({
  cnpj: z.string(),
  name: z.string(),
  areas: z.array(z.string()),
  size: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']),
  state: z.string(),
  city: z.string(),
});

const OrganizationSchema = z.object({
  id: z.string(),
  cnpj: z.string(),
  name: z.string(),
  areas: z.array(z.string()),
  size: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']),
  location: z.string(),
  createdAt: z.coerce.date(),
});

const ErrorSchema = z.object({ error: z.string(), message: z.string().optional() });

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function organizationRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /organizations/:cnpj ─────────────────────────────────────────────
  f.get(
    '/:cnpj',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Buscar perfil de OSC pelo CNPJ (Mapa das OSCs / Ipea)',
        description: 'Consulta a API do Mapa das OSCs. Resultado cacheado no Redis por 7 dias.',
        params: z.object({
          cnpj: z
            .string()
            .regex(CNPJ_RE, 'CNPJ must be 14 digits (no formatting)')
            .describe('CNPJ com 14 dígitos, sem pontos ou traços'),
        }),
        response: {
          200: OscProfileSchema,
          404: ErrorSchema,
          502: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      let profile;

      try {
        profile = await fetchOscProfile(req.params.cnpj, app.redis);
      } catch (err) {
        app.log.error({ err, cnpj: req.params.cnpj }, 'OSC API request failed');
        return reply.status(502).send({
          error: 'External API error',
          message: 'Não foi possível consultar o Mapa das OSCs. Tente novamente.',
        });
      }

      if (!profile) {
        return reply.status(404).send({
          error: 'Not found',
          message: `Nenhuma OSC encontrada para o CNPJ ${req.params.cnpj}.`,
        });
      }

      return reply.send(profile);
    },
  );

  // ── POST /organizations/register ─────────────────────────────────────────
  f.post(
    '/register',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Cadastrar organização a partir do CNPJ',
        description:
          'Tenta buscar o perfil no Mapa das OSCs. Se não encontrado, aceita campos opcionais ' +
          'para cadastro manual. Se o CNPJ já estiver cadastrado, retorna o perfil existente.',
        body: z.object({
          cnpj: z
            .string()
            .regex(CNPJ_RE, 'CNPJ must be 14 digits (no formatting)')
            .describe('CNPJ com 14 dígitos'),
          name: z
            .string()
            .optional()
            .describe('Nome da organização (usado se não encontrado no IPEA)'),
          size: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']).optional(),
          areas: z.array(z.string()).optional(),
          city: z.string().optional(),
          state: z.string().optional(),
        }),
        response: {
          200: OrganizationSchema.extend({ _existing: z.boolean() }),
          201: OrganizationSchema.extend({ _existing: z.boolean() }),
          400: ErrorSchema,
          502: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const {
        cnpj,
        name: manualName,
        size: manualSize,
        areas: manualAreas,
        city,
        state,
      } = req.body;

      // Return existing if already registered
      const existing = await app.prisma.organization.findUnique({ where: { cnpj } });
      if (existing) {
        return reply.status(200).send({ ...existing, _existing: true });
      }

      // Try to fetch from Mapa das OSCs
      let profile;
      try {
        profile = await fetchOscProfile(cnpj, app.redis);
      } catch (err) {
        app.log.warn(
          { err, cnpj },
          'OSC API request failed during register — falling back to manual data',
        );
      }

      const name = profile?.name ?? manualName;
      if (!name) {
        return reply.status(400).send({
          error: 'Missing required field',
          message:
            'Informe o campo "name" para cadastro manual quando a OSC não está no Mapa das OSCs.',
        });
      }

      const org = await app.prisma.organization.create({
        data: {
          cnpj,
          name,
          areas: profile?.areas ?? manualAreas ?? [],
          size: profile?.size ?? manualSize ?? 'MICRO',
          location: [profile?.city ?? city, profile?.state ?? state].filter(Boolean).join(', '),
        },
      });

      return reply.status(201).send({ ...org, _existing: false });
    },
  );

  // ── GET /organizations (internal list) ───────────────────────────────────
  f.get(
    '/',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Listar organizações cadastradas',
        response: { 200: z.array(OrganizationSchema) },
      },
    },
    async (_req, reply) => {
      const orgs = await app.prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return reply.send(orgs);
    },
  );
}
