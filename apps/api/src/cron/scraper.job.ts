import type { PrismaClient } from '@prisma/client';
import {
  MinisterioEsporteScraper,
  MinisterioCriancaScraper,
  MinisterioIdosoScraper,
  runScrapers,
} from '../scrapers/index.js';
import { GifeScraper, AbcScraper } from '../scrapers/index.js';

export async function runMinistryScrapeJob(prisma: PrismaClient): Promise<void> {
  console.log('[scraper:ministerios] Starting ministry scrape job...');
  const startedAt = Date.now();

  const scrapers = [
    new MinisterioEsporteScraper(),
    new MinisterioCriancaScraper(),
    new MinisterioIdosoScraper(),
  ];

  const results = await runScrapers(scrapers, prisma);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  for (const r of results) {
    if (r.error) {
      console.error(`[scraper:${r.source}] FAILED — ${r.error}`);
    } else {
      console.log(`[scraper:${r.source}] OK — found=${r.itemsFound} upserted=${r.itemsUpserted}`);
    }
  }

  console.log(`[scraper:ministerios] Finished in ${elapsed}s`);
}

export async function runPrivateScrapeJob(prisma: PrismaClient): Promise<void> {
  console.log('[scraper:privados] Starting private sources scrape job...');
  const startedAt = Date.now();

  const scrapers = [new GifeScraper(), new AbcScraper()];

  const results = await runScrapers(scrapers, prisma);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  for (const r of results) {
    if (r.error) {
      console.error(`[scraper:${r.source}] FAILED — ${r.error}`);
    } else {
      console.log(`[scraper:${r.source}] OK — found=${r.itemsFound} upserted=${r.itemsUpserted}`);
    }
  }

  console.log(`[scraper:privados] Finished in ${elapsed}s`);
}
