-- AlterTable: add AI enrichment columns to Opportunity
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "aiSummary"          TEXT,
  ADD COLUMN IF NOT EXISTS "eligibleOrgProfile" TEXT,
  ADD COLUMN IF NOT EXISTS "firstSteps"         TEXT[] NOT NULL DEFAULT '{}';
