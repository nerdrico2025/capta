-- Saúde de links: campos de verificação na Opportunity + novos tipos de alerta

ALTER TABLE "Opportunity" ADD COLUMN "linkCheckedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN "linkStatus" TEXT;

ALTER TYPE "DataAlertType" ADD VALUE 'LINK_REQUIRES_AUTH';
ALTER TYPE "DataAlertType" ADD VALUE 'LINK_RELATIVE';

CREATE INDEX "Opportunity_linkCheckedAt_idx" ON "Opportunity"("linkCheckedAt");
