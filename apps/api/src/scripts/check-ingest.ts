import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const logs = await prisma.ingestLog.findMany({
  where: { source: { in: ['PROSAS', 'FAPEMIG'] } },
  orderBy: { startedAt: 'desc' },
  take: 4,
});

console.log(JSON.stringify(logs, null, 2));
await prisma.$disconnect();
