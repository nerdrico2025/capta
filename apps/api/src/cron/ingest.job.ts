import type { PrismaClient } from '@prisma/client';
import { runAllCollectors } from '../collectors/index.js';

export async function runIngestJob(prisma: PrismaClient): Promise<void> {
  console.log('[ingest] Starting daily ingest job...');
  const startedAt = Date.now();

  const results = await runAllCollectors(prisma);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  for (const r of results) {
    if (r.error) {
      console.error(`[ingest:${r.source}] FAILED — ${r.error}`);
    } else {
      console.log(`[ingest:${r.source}] OK — found=${r.itemsFound} upserted=${r.itemsUpserted}`);
    }
  }

  console.log(`[ingest] Finished in ${elapsed}s`);
}
