import cron from 'node-cron';
import type { FastifyInstance } from 'fastify';
import { runIngestJob } from './ingest.job.js';
import { runAlertsJob } from './alerts.job.js';
import { runMinistryScrapeJob, runPrivateScrapeJob } from './scraper.job.js';
import { runValidationJob } from './validation.job.js';

export function registerCronJobs(app: FastifyInstance): void {
  // API collectors (SALIC, TransferGov) — daily at 03:00
  cron.schedule('0 3 * * *', async () => {
    try {
      await runIngestJob(app.prisma);
    } catch (err) {
      app.log.error({ err }, '[cron:ingest] Unexpected top-level error');
    }
  });

  // Data validation pipeline — daily at 06:00
  cron.schedule('0 6 * * *', async () => {
    const start = Date.now();
    try {
      const result = await runValidationJob(app.prisma);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      app.log.info(
        { result },
        `[cron:validation] Finished in ${elapsed}s — ` +
          `expired=${result.expiredDeactivated} stale=${result.staleAlertsFlagged} ` +
          `resolved=${result.staleFreshResolved} dead=${result.staleDeadResolved} ` +
          `missingSummary=${result.missingAiSummaryFlagged}`,
      );
    } catch (err) {
      app.log.error({ err }, '[cron:validation] Unexpected top-level error');
    }
  });

  // Deadline alerts — daily at 08:00
  cron.schedule('0 8 * * *', async () => {
    try {
      await runAlertsJob(app.prisma);
    } catch (err) {
      app.log.error({ err }, '[cron:alerts] Unexpected top-level error');
    }
  });

  // Ministry scrapers — monthly on the 1st at 04:00
  cron.schedule('0 4 1 * *', async () => {
    try {
      await runMinistryScrapeJob(app.prisma);
    } catch (err) {
      app.log.error({ err }, '[cron:scraper:ministerios] Unexpected top-level error');
    }
  });

  // Private sources (GIFE, ABC) — weekly on Monday at 05:00
  cron.schedule('0 5 * * 1', async () => {
    try {
      await runPrivateScrapeJob(app.prisma);
    } catch (err) {
      app.log.error({ err }, '[cron:scraper:privados] Unexpected top-level error');
    }
  });

  app.log.info('[cron] Ingest job scheduled — daily at 03:00');
  app.log.info('[cron] Validation job scheduled — daily at 06:00');
  app.log.info('[cron] Alerts job scheduled — daily at 08:00');
  app.log.info('[cron] Ministry scraper scheduled — monthly on 1st at 04:00');
  app.log.info('[cron] Private scraper scheduled — weekly on Monday at 05:00');
}
