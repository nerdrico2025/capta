import type { PrismaClient } from '@prisma/client';
import { TransferegovCollector } from './transferegov.collector.js';
import { SalicCollector } from './salic.collector.js';
import type { CollectorResult } from './types.js';

export { TransferegovCollector } from './transferegov.collector.js';
export { SalicCollector } from './salic.collector.js';
export type { CollectorResult } from './types.js';

export async function runAllCollectors(prisma: PrismaClient): Promise<CollectorResult[]> {
  const collectors = [new TransferegovCollector(), new SalicCollector()];

  const results = await Promise.allSettled(collectors.map((c) => c.run({ prisma })));

  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;

    const source = collectors[i].source;
    const error = result.reason instanceof Error ? result.reason.message : String(result.reason);

    console.error(`[collector:${source}] Unhandled error:`, result.reason);

    return { source, itemsFound: 0, itemsUpserted: 0, error };
  });
}
