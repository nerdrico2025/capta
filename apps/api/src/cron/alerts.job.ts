import type { PrismaClient } from '@prisma/client';
import { processAlerts } from '../services/alert.service.js';
import { createEmailService } from '../services/email/email.service.js';

export async function runAlertsJob(prisma: PrismaClient): Promise<void> {
  console.log('[alerts] Starting daily alerts job...');
  const startedAt = Date.now();

  let emailService;
  try {
    emailService = createEmailService();
  } catch (err) {
    console.error('[alerts] Failed to initialize email service:', err);
    return;
  }

  const result = await processAlerts(prisma, emailService);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(
    `[alerts] Finished in ${elapsed}s — ` +
      `created=${result.alertsCreated} sent=${result.emailsSent} failed=${result.emailsFailed}`,
  );

  if (result.errors.length > 0) {
    console.error('[alerts] Errors:', result.errors);
  }
}
