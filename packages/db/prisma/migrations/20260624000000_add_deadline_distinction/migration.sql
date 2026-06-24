-- Distinção de prazos + status da fonte + derivado isOpen

ALTER TABLE "Opportunity" ADD COLUMN "submissionDeadline" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN "executionDeadline" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN "fundraisingWindowStart" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN "fundraisingWindowEnd" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN "sourceStatus" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "isOpen" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: o antigo "deadline" passa a ser o prazo de submissão
UPDATE "Opportunity" SET "submissionDeadline" = "deadline";

-- Recalcula isOpen a partir dos dados existentes (now < submissionDeadline AND ativo)
UPDATE "Opportunity"
  SET "isOpen" = ("submissionDeadline" > NOW() AND "isActive" = true);

-- Índices para o filtro duro
CREATE INDEX "Opportunity_isOpen_idx" ON "Opportunity"("isOpen");
CREATE INDEX "Opportunity_submissionDeadline_idx" ON "Opportunity"("submissionDeadline");
