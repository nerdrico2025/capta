-- CreateEnum
CREATE TYPE "OpportunityScope" AS ENUM ('NATIONAL', 'STATE', 'MUNICIPAL');

-- AlterTable
ALTER TABLE "Opportunity"
  ADD COLUMN "scope" "OpportunityScope" NOT NULL DEFAULT 'NATIONAL',
  ADD COLUMN "scopeLocation" TEXT,
  ADD COLUMN "targetSizes" "OrganizationSize"[] NOT NULL DEFAULT '{}';
