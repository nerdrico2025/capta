import { PrismaClient } from '@prisma/client';
import { ResendEmailService } from '../services/email/email.service.js';
import { processAlerts } from '../services/alert.service.js';

const prisma = new PrismaClient();

const emailService = new ResendEmailService(
  process.env.RESEND_API_KEY!,
  process.env.EMAIL_FROM ?? 'Capta <onboarding@resend.dev>',
);

console.log('[alerts] Disparando job manualmente...');
const result = await processAlerts(prisma, emailService);

console.log('[alerts] Resultado:', JSON.stringify(result, null, 2));

await prisma.$disconnect();
