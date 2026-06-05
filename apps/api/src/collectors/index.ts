import type { PrismaClient } from '@prisma/client';
// TransferegovCollector desativado: API pública não existe (Portal da Transparência
// não expõe chamamentos; transferegov.sistema.gov.br e siconv.centralit.com.br estão fora do ar)
import { SalicCollector } from './salic.collector.js';
import { FinepCollector } from './finep.collector.js';
import { GifeCollector } from './gife.collector.js';
import { ItauSocialCollector } from './itau-social.collector.js';
import { FundacaoValeCollector } from './fundacao-vale.collector.js';
import { FundacaoLemannCollector } from './fundacao-lemann.collector.js';

import { ElasCollector } from './elas.collector.js';
import { FundacaoBBCollector } from './fundacao-bb.collector.js';
import { ProsasCollector } from './prosas.collector.js';
import { FapespCollector } from './fapesp.collector.js';
import { FaperjCollector } from './faperj.collector.js';
import { FapemigCollector } from './fapemig.collector.js';
import type { CollectorResult } from './types.js';

export { SalicCollector } from './salic.collector.js';
export { FinepCollector } from './finep.collector.js';
export { GifeCollector } from './gife.collector.js';
export { ItauSocialCollector } from './itau-social.collector.js';
export { FundacaoValeCollector } from './fundacao-vale.collector.js';
export { FundacaoLemannCollector } from './fundacao-lemann.collector.js';
export { NaturaCollector } from './natura.collector.js';
export { ElasCollector } from './elas.collector.js';
export { FundacaoBBCollector } from './fundacao-bb.collector.js';
export { ProsasCollector } from './prosas.collector.js';
export { FapespCollector } from './fapesp.collector.js';
export { FaperjCollector } from './faperj.collector.js';
export { FapemigCollector } from './fapemig.collector.js';
export type { CollectorResult } from './types.js';

function settledToResult(
  result: PromiseSettledResult<CollectorResult>,
  source: string,
): CollectorResult {
  if (result.status === 'fulfilled') return result.value;
  const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
  console.error(`[collector:${source}] Unhandled error:`, result.reason);
  return { source, itemsFound: 0, itemsUpserted: 0, error };
}

export async function runAllCollectors(prisma: PrismaClient): Promise<CollectorResult[]> {
  // Collectors que usam Puppeteer rodam em série para evitar OOM no Railway
  const puppeteerCollectors = [new ProsasCollector(), new FapemigCollector()];

  const parallelCollectors = [
    new SalicCollector(),
    new FinepCollector(),
    new GifeCollector(),
    new ItauSocialCollector(),
    new FundacaoValeCollector(),
    new FundacaoLemannCollector(),
    // NaturaCollector desativado: Instituto Natura não publica editais abertos para OSCs externas
    new ElasCollector(),
    new FundacaoBBCollector(),
    new FapespCollector(),
    new FaperjCollector(),
  ];

  const parallelSettled = await Promise.allSettled(
    parallelCollectors.map((c) => c.run({ prisma })),
  );
  const parallelResults = parallelSettled.map((r, i) =>
    settledToResult(r, parallelCollectors[i].source),
  );

  const puppeteerResults: CollectorResult[] = [];
  for (const collector of puppeteerCollectors) {
    try {
      puppeteerResults.push(await collector.run({ prisma }));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[collector:${collector.source}] Unhandled error:`, err);
      puppeteerResults.push({ source: collector.source, itemsFound: 0, itemsUpserted: 0, error });
    }
  }

  return [...parallelResults, ...puppeteerResults];
}
