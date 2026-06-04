import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { organizationRoutes } from './organizations.js';
import { opportunityRoutes } from './opportunities.js';
import { alertRoutes } from './alerts.js';
import { adminRoutes } from './admin.js';
import { pushRoutes } from './push.js';

export async function routes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();

  f.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Health check',
        response: {
          200: z.object({ status: z.string(), timestamp: z.string() }),
        },
      },
    },
    async () => ({ status: 'ok', timestamp: new Date().toISOString() }),
  );

  app.register(organizationRoutes, { prefix: '/api/organizations' });
  app.register(opportunityRoutes, { prefix: '/api/opportunities' });
  app.register(alertRoutes, { prefix: '/api/alerts' });
  app.register(pushRoutes, { prefix: '/api/push' });
  app.register(adminRoutes, { prefix: '/api/admin' });
}
