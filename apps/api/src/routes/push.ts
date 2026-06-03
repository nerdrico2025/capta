import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { VAPID_PUBLIC_KEY } from '../services/push.service.js';

const CNPJ_RE = /^\d{14}$/;
const ErrorSchema = z.object({ error: z.string(), message: z.string().optional() });

export async function pushRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /push/vapid-key — public VAPID key for the client ────────────────
  f.get(
    '/vapid-key',
    {
      schema: {
        tags: ['Push'],
        summary: 'Retorna a chave VAPID pública para inscrição de push',
        response: {
          200: z.object({ publicKey: z.string() }),
        },
      },
    },
    async (_req, reply) => {
      return reply.send({ publicKey: VAPID_PUBLIC_KEY });
    },
  );

  // ── POST /push/subscribe — save a PushSubscription ──────────────────────
  f.post(
    '/subscribe',
    {
      schema: {
        tags: ['Push'],
        summary: 'Salvar inscrição de push para uma organização',
        body: z.object({
          cnpj: z.string().regex(CNPJ_RE, 'CNPJ deve conter 14 dígitos'),
          endpoint: z.string().url(),
          p256dh: z.string().min(1),
          auth: z.string().min(1),
        }),
        response: {
          201: z.object({ id: z.string() }),
          404: ErrorSchema,
          409: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const { cnpj, endpoint, p256dh, auth } = req.body;

      const org = await app.prisma.organization.findUnique({ where: { cnpj } });
      if (!org) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      // Upsert: if endpoint already exists for another org, update it; otherwise create
      const existing = await app.prisma.pushSubscription.findUnique({ where: { endpoint } });
      if (existing && existing.organizationId !== org.id) {
        // Endpoint moved to a different org (re-registration) — update it
        const updated = await app.prisma.pushSubscription.update({
          where: { endpoint },
          data: { organizationId: org.id, p256dh, auth },
          select: { id: true },
        });
        return reply.status(201).send({ id: updated.id });
      }

      if (existing) {
        return reply
          .status(409)
          .send({ error: 'Already subscribed', message: 'This endpoint is already registered.' });
      }

      const sub = await app.prisma.pushSubscription.create({
        data: { organizationId: org.id, endpoint, p256dh, auth },
        select: { id: true },
      });

      return reply.status(201).send({ id: sub.id });
    },
  );

  // ── POST /push/unsubscribe — remove a PushSubscription ──────────────────
  f.post(
    '/unsubscribe',
    {
      schema: {
        tags: ['Push'],
        summary: 'Remover inscrição de push',
        body: z.object({
          endpoint: z.string().url(),
        }),
        response: {
          200: z.object({ ok: z.boolean() }),
          404: ErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const { endpoint } = req.body;

      const sub = await app.prisma.pushSubscription.findUnique({ where: { endpoint } });
      if (!sub) {
        return reply.status(404).send({ error: 'Subscription not found' });
      }

      await app.prisma.pushSubscription.delete({ where: { endpoint } });
      return reply.send({ ok: true });
    },
  );
}
