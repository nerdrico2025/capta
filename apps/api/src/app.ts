import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { routes } from './routes/index.js';
import { registerCronJobs } from './cron/index.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Zod type provider — must be set before any route registration
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(helmet, {
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  });

  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Swagger must be registered before routes to capture their schemas
  app.register(swaggerPlugin);

  app.register(prismaPlugin);
  app.register(redisPlugin);
  app.register(routes);

  // Cron jobs start after all plugins are initialized
  app.addHook('onReady', async () => {
    if (process.env.NODE_ENV !== 'test') {
      registerCronJobs(app);
    }
  });

  return app;
}
