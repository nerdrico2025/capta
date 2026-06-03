-- CreateEnum
CREATE TYPE "DataAlertType" AS ENUM ('EXPIRED_NOT_DEACTIVATED', 'STALE_DATA', 'SCRAPE_FAILED', 'MISSING_SUMMARY');

-- AlterTable: add pushSubscriptions relation (handled via new model)

-- AlterTable: add dataAlerts relation to Opportunity (handled via new model)

-- CreateTable: PushSubscription
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DataAlert
CREATE TABLE "DataAlert" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "type" "DataAlertType" NOT NULL,
    "message" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_organizationId_idx" ON "PushSubscription"("organizationId");

-- CreateIndex
CREATE INDEX "DataAlert_opportunityId_idx" ON "DataAlert"("opportunityId");
CREATE INDEX "DataAlert_type_idx" ON "DataAlert"("type");
CREATE INDEX "DataAlert_resolvedAt_idx" ON "DataAlert"("resolvedAt");
CREATE INDEX "DataAlert_createdAt_idx" ON "DataAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAlert" ADD CONSTRAINT "DataAlert_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
