import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../services/unsubscribe.service.js';

const CNPJ_RE = /^\d{14}$/;
const ErrorSchema = z.object({ error: z.string(), message: z.string().optional() });

const PreferenceSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  areas: z.array(z.string()),
  days: z.array(z.number()),
  emailEnabled: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export async function alertRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // ── POST /alerts/preferences ────────────────────────────────────────────
  f.post(
    '/preferences',
    {
      schema: {
        tags: ['Alerts'],
        summary: 'Criar ou atualizar preferências de alerta',
        body: z.object({
          cnpj: z.string().regex(CNPJ_RE, 'CNPJ deve ter 14 dígitos'),
          email: z.string().email(),
          areas: z.array(z.string()).default([]),
          days: z
            .array(z.union([z.literal(1), z.literal(7), z.literal(15)]))
            .min(1)
            .default([15, 7, 1]),
        }),
        response: {
          200: PreferenceSchema.extend({ _action: z.literal('updated') }),
          201: PreferenceSchema.extend({ _action: z.literal('created') }),
          404: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const { cnpj, email, areas, days } = req.body;

      const org = await app.prisma.organization.findUnique({ where: { cnpj } });
      if (!org) {
        return reply.status(404).send({
          error: 'Organization not found',
          message: `Nenhuma organização cadastrada com o CNPJ ${cnpj}. Use POST /api/organizations/register primeiro.`,
        });
      }

      const existing = await app.prisma.alertPreference.findUnique({
        where: { organizationId: org.id },
      });

      if (existing) {
        const updated = await app.prisma.alertPreference.update({
          where: { organizationId: org.id },
          data: { email, areas, days, emailEnabled: true },
        });
        return reply.status(200).send({ ...updated, _action: 'updated' });
      }

      const created = await app.prisma.alertPreference.create({
        data: {
          organizationId: org.id,
          email,
          areas,
          days,
          emailEnabled: true,
          unsubscribeToken: generateUnsubscribeToken(cnpj),
        },
      });

      return reply.status(201).send({ ...created, _action: 'created' });
    },
  );

  // ── GET /alerts/preferences/:cnpj ───────────────────────────────────────
  f.get(
    '/preferences/:cnpj',
    {
      schema: {
        tags: ['Alerts'],
        summary: 'Consultar preferências de alerta de uma organização',
        params: z.object({ cnpj: z.string().regex(CNPJ_RE) }),
        response: {
          200: PreferenceSchema,
          404: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const org = await app.prisma.organization.findUnique({
        where: { cnpj: req.params.cnpj },
      });
      if (!org) return reply.status(404).send({ error: 'Organization not found' });

      const pref = await app.prisma.alertPreference.findUnique({
        where: { organizationId: org.id },
      });
      if (!pref) return reply.status(404).send({ error: 'No alert preferences found' });

      return reply.send(pref);
    },
  );

  // ── DELETE /alerts/unsubscribe/:token ───────────────────────────────────
  f.delete(
    '/unsubscribe/:token',
    {
      schema: {
        tags: ['Alerts'],
        summary: 'Cancelar alertas via token de descadastro',
        description:
          'Desabilita todos os alertas da organização. O token é gerado via HMAC-SHA256 do CNPJ.',
        params: z.object({ token: z.string().length(64) }),
        response: {
          200: z.object({ message: z.string() }),
          404: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const pref = await app.prisma.alertPreference.findUnique({
        where: { unsubscribeToken: req.params.token },
        include: { organization: { select: { cnpj: true, name: true } } },
      });

      if (!pref) {
        return reply.status(404).send({ error: 'Invalid or expired unsubscribe token' });
      }

      // Secondary HMAC verification for extra safety
      if (!verifyUnsubscribeToken(pref.organization.cnpj, req.params.token)) {
        return reply.status(404).send({ error: 'Invalid unsubscribe token' });
      }

      await app.prisma.alertPreference.update({
        where: { id: pref.id },
        data: { emailEnabled: false },
      });

      return reply.send({
        message: `Alertas cancelados com sucesso para ${pref.organization.name}. Você não receberá mais notificações.`,
      });
    },
  );
}
