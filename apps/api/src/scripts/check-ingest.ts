import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const logs = await prisma.ingestLog.findMany({
  where: { source: { in: ['FUNDO_BRASIL', 'ONU_MULHERES', 'CAPTADORES'] } },
  orderBy: { startedAt: 'desc' },
  take: 6,
});

console.log(
  JSON.stringify(
    logs.map((l) => ({
      source: l.source,
      status: l.status,
      found: l.itemsFound,
      upserted: l.itemsUpserted,
      error: l.errorMessage,
    })),
    null,
    2,
  ),
);

await prisma.$disconnect();
