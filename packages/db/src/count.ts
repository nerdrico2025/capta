import { prisma } from './index.js';

async function main() {
  const r = await prisma.opportunity.groupBy({ by: ['source'], _count: true });
  console.log(JSON.stringify(r, null, 2));
  await prisma.$disconnect();
}

main();
