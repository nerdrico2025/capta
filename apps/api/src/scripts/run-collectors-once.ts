/**
 * run-collectors-once.ts — roda manualmente todos os collectors funcionais,
 * EXCETO Transferegov (desativado / API inexistente) e SALIC (excluído a pedido).
 *
 * Espelha a estrutura de runAllCollectors: paralelos rápidos + GIFE, e os
 * Puppeteer (Prosas, FAPEMIG) em série. Cada .run() já grava em ingestLog e
 * retorna { source, itemsFound, itemsUpserted, error } sem lançar.
 *
 * Rodar de apps/api/:  tsx --env-file=.env src/scripts/run-collectors-once.ts
 */
import { PrismaClient } from '@prisma/client';
import type { CollectorResult } from '../collectors/index.js';
import {
  GifeCollector,
  FinepCollector,
  ItauSocialCollector,
  FundacaoValeCollector,
  FundacaoLemannCollector,
  ElasCollector,
  FundacaoBBCollector,
  FapespCollector,
  FaperjCollector,
  Observatorio3SetorCollector,
  MincCollector,
  EscolaAberta3SetorCollector,
  FundoBrasilCollector,
  CaptadoresCollector,
  ProsasCollector,
  FapemigCollector,
} from '../collectors/index.js';

const prisma = new PrismaClient();
const startedAt = Date.now();

// Paralelos (inclui GIFE, que é lento por causa do LLM, mas roda junto aqui).
const parallel = [
  new FinepCollector(),
  new GifeCollector(),
  new ItauSocialCollector(),
  new FundacaoValeCollector(),
  new FundacaoLemannCollector(),
  new ElasCollector(),
  new FundacaoBBCollector(),
  new FapespCollector(),
  new FaperjCollector(),
  new Observatorio3SetorCollector(),
  new MincCollector(),
  new EscolaAberta3SetorCollector(),
  new FundoBrasilCollector(),
  new CaptadoresCollector(),
];

// Puppeteer em série (um Chromium por vez).
const puppeteer = [new ProsasCollector(), new FapemigCollector()];

console.log(
  `[run-collectors] Iniciando ${parallel.length} paralelos + ${puppeteer.length} Puppeteer ` +
    `(sem Transferegov, sem SALIC)...`,
);

const settled = await Promise.allSettled(parallel.map((c) => c.run({ prisma })));
const results: CollectorResult[] = settled.map((r, i) =>
  r.status === 'fulfilled'
    ? r.value
    : {
        source: parallel[i].source,
        itemsFound: 0,
        itemsUpserted: 0,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      },
);

for (const c of puppeteer) {
  try {
    results.push(await c.run({ prisma }));
  } catch (err) {
    results.push({
      source: c.source,
      itemsFound: 0,
      itemsUpserted: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

console.log('\n' + '='.repeat(72));
console.log(`RESULTADO DA COLETA — concluído em ${elapsed}s`);
console.log('='.repeat(72));
console.log('  ' + 'FONTE'.padEnd(22) + 'FOUND'.padStart(8) + 'UPSERTED'.padStart(10) + '  STATUS');
const sorted = [...results].sort((a, b) => b.itemsUpserted - a.itemsUpserted);
let totalFound = 0;
let totalUpserted = 0;
for (const r of sorted) {
  totalFound += r.itemsFound;
  totalUpserted += r.itemsUpserted;
  const status = r.error ? `ERRO: ${r.error.slice(0, 60)}` : 'OK';
  console.log(
    '  ' +
      r.source.padEnd(22) +
      String(r.itemsFound).padStart(8) +
      String(r.itemsUpserted).padStart(10) +
      `  ${status}`,
  );
}
console.log('  ' + '-'.repeat(60));
console.log(
  '  ' + 'TOTAL'.padEnd(22) + String(totalFound).padStart(8) + String(totalUpserted).padStart(10),
);

const opps = await prisma.opportunity.count();
console.log(`\n  Opportunities no banco agora: ${opps}`);

await prisma.$disconnect();
