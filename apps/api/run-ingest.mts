import { PrismaClient } from '@prisma/client';
import { runAllCollectors } from './src/collectors/index.js';

const prisma = new PrismaClient();
console.log('Iniciando ingestão...');

const results = await runAllCollectors(prisma);

for (const r of results) {
  if (r.error) {
    console.error(`${r.source} FALHOU: ${r.error}`);
  } else {
    console.log(`${r.source} OK — encontrados=${r.itemsFound} inseridos/atualizados=${r.itemsUpserted}`);
  }
}

await prisma.$disconnect();
