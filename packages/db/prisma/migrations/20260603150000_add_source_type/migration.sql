-- AlterTable: add sourceType to Opportunity (distinguishes api vs scraper vs manual)
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'api';
