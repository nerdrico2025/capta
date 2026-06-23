/**
 * rerun-bb-itau.ts — apaga as linhas das fontes FUNDACAO_BB e ITAU_SOCIAL
 * (chaveadas por sourceUrl, não sobrescritas pelo upsert) e re-roda os dois
 * collectors já corrigidos, validando sourceUrl (http) e deadline (futura).
 *
 * Rodar de apps/api/:  tsx --env-file=.env src/scripts/rerun-bb-itau.ts
 */
import { PrismaClient } from '@prisma/client';
import { FundacaoBBCollector, ItauSocialCollector } from '../collectors/index.js';

const prisma = new PrismaClient();
const SOURCES = ['FUNDACAO_BB', 'ITAU_SOCIAL'];

const del = await prisma.opportunity.deleteMany({ where: { source: { in: SOURCES } } });
console.log(`Apagadas ${del.count} linhas antigas de ${SOURCES.join(' / ')}.`);

for (const c of [new FundacaoBBCollector(), new ItauSocialCollector()]) {
  const r = await c.run({ prisma });
  console.log(
    `[${r.source}] found=${r.itemsFound} upserted=${r.itemsUpserted}` +
      (r.error ? ` ERRO: ${r.error}` : ''),
  );
}

const rows = await prisma.opportunity.findMany({
  where: { source: { in: SOURCES } },
  select: { source: true, title: true, sourceUrl: true, deadline: true, isActive: true },
  orderBy: [{ source: 'asc' }, { deadline: 'asc' }],
});

console.log(`\nRegistros resultantes: ${rows.length}`);
const now = new Date();
let bad = 0;
for (const o of rows) {
  const urlOk = o.sourceUrl.startsWith('http');
  const dateOk = o.deadline > now;
  if (!urlOk || !dateOk) bad++;
  console.log(
    `  [${o.source}] urlOk=${urlOk} dateOk=${dateOk} deadline=${o.deadline.toISOString().slice(0, 10)}\n` +
      `    ${o.title.slice(0, 60)}\n` +
      `    ${o.sourceUrl}`,
  );
}
console.log(
  `\n${bad === 0 ? '✅ TODOS válidos (sourceUrl http + deadline futura)' : `❌ ${bad} inválidos`}`,
);

await prisma.$disconnect();
