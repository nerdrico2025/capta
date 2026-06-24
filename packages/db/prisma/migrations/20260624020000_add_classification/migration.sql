-- Classificação EDITAL_OFICIAL vs MATERIA vs INDEFINIDO

ALTER TABLE "Opportunity" ADD COLUMN "classification" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "classificationScore" DOUBLE PRECISION;
ALTER TABLE "Opportunity" ADD COLUMN "classifiedAt" TIMESTAMP(3);

CREATE INDEX "Opportunity_classification_idx" ON "Opportunity"("classification");
