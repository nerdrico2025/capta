import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import type { FastifyInstance } from 'fastify';

export const swaggerPlugin = fp(async (app: FastifyInstance) => {
  app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Capta API',
        description:
          'Plataforma para descoberta e gestão de editais e recursos públicos para OSCs.',
        version: '1.0.0',
        contact: { email: 'contato@capta.app' },
      },
      servers: [{ url: process.env.API_URL ?? 'http://localhost:3001' }],
      tags: [
        { name: 'Opportunities', description: 'Editais e oportunidades de financiamento' },
        { name: 'Organizations', description: 'Perfil e cadastro de OSCs' },
        { name: 'System', description: 'Healthcheck e status' },
      ],
      components: {
        securitySchemes: {
          OrgCnpj: {
            type: 'apiKey',
            in: 'header',
            name: 'x-org-cnpj',
            description: 'CNPJ da organização (14 dígitos, sem formatação)',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { deepLinking: true, displayRequestDuration: true },
    staticCSP: true,
  });
});
