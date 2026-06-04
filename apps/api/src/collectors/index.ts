import type { PrismaClient } from '@prisma/client';
// TransferegovCollector desativado: API pública não existe (Portal da Transparência
// não expõe chamamentos; transferegov.sistema.gov.br e siconv.centralit.com.br estão fora do ar)
import { SalicCollector } from './salic.collector.js';
import { FinepCollector } from './finep.collector.js';
import { GifeCollector } from './gife.collector.js';
import type { CollectorResult } from './types.js';

export { SalicCollector } from './salic.collector.js';
export { FinepCollector } from './finep.collector.js';
export { GifeCollector } from './gife.collector.js';
export type { CollectorResult } from './types.js';

export async function runAllCollectors(prisma: PrismaClient): Promise<CollectorResult[]> {
  const standardCollectors = [new SalicCollector(), new FinepCollector()];
  const allCollectors = [...standardCollectors, new GifeCollector()];

  const settled = await Promise.allSettled(allCollectors.map((c) => c.run({ prisma })));

  return settled.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;

    const source = allCollectors[i].source;
    const error = result.reason instanceof Error ? result.reason.message : String(result.reason);

    console.error(`[collector:${source}] Unhandled error:`, result.reason);

    return { source, itemsFound: 0, itemsUpserted: 0, error };
  });
}
