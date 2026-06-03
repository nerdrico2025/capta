import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processAlerts } from '../alert.service.js';
import type { EmailService, SendPayload, SendResult } from '../email/email.service.js';
import type { PrismaClient, Prisma } from '@prisma/client';

// ─── Test doubles ──────────────────────────────────────────────────────────────

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0); // noon so it sits inside startOfDay / endOfDay
  return d;
}

function makeOpportunity(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'opp-1',
    title: 'Edital Cultural 2025',
    source: 'Transferegov',
    type: 'EDITAL',
    sourceUrl: 'https://example.gov.br/edital/1',
    deadline: daysFromNow(7),
    value: { toNumber: () => 150000 } as unknown as Prisma.Decimal,
    areas: ['cultura', 'educação'],
    summary: 'Apoio a projetos culturais.',
    pdfUrl: null,
    portalUrl: 'https://example.gov.br/portal/1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePreference(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pref-1',
    organizationId: 'org-1',
    email: 'osc@example.com',
    areas: ['cultura'],
    days: [15, 7, 1],
    emailEnabled: true,
    unsubscribeToken: 'abc123',
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: { name: 'Associação Cultural Exemplo', cnpj: '12345678000195' },
    ...overrides,
  };
}

function makePendingAlert(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'alert-1',
    organizationId: 'org-1',
    opportunityId: 'opp-1',
    triggerDays: 7,
    type: 'DAYS_7',
    email: 'osc@example.com',
    status: 'PENDING',
    sentAt: null,
    opportunity: {
      title: 'Edital Cultural 2025',
      source: 'Transferegov',
      value: 150000,
      deadline: daysFromNow(7),
      portalUrl: 'https://example.gov.br/portal/1',
      areas: ['cultura'],
    },
    organization: { name: 'Associação Cultural Exemplo', cnpj: '12345678000195' },
    ...overrides,
  };
}

// Build a minimal PrismaClient mock
function createMockPrisma() {
  return {
    opportunity: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    alertPreference: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    alert: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'alert-new', status: 'PENDING' }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'alert-1', status: 'SENT' }),
    },
    pushSubscription: {
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

// Captures all emails sent during a test
function createCaptureEmailService(): EmailService & { captured: SendPayload[] } {
  const captured: SendPayload[] = [];
  return {
    captured,
    async send(payload: SendPayload): Promise<SendResult> {
      captured.push(payload);
      return { success: true, messageId: `msg-${captured.length}` };
    },
    async batchSend(payloads: SendPayload[], _rate?: number): Promise<SendResult[]> {
      for (const p of payloads) captured.push(p);
      return payloads.map((_, i) => ({ success: true, messageId: `msg-${i}` }));
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processAlerts — 7-day alert integration', () => {
  let prisma: PrismaClient;
  let emailService: ReturnType<typeof createCaptureEmailService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    emailService = createCaptureEmailService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it('creates a PENDING alert when opportunity deadline is 7 days away and org area matches', async () => {
    const opp = makeOpportunity({ deadline: daysFromNow(7) });
    const pref = makePreference({ areas: ['cultura'], days: [7] });

    // processAlerts iterates [15, 7, 1].
    // When opportunity.findMany returns [], createPendingAlertsForDay early-returns (no alertPreference call).
    // So alertPreference.findMany is only called for days that have opportunities.
    vi.mocked(prisma.opportunity.findMany)
      .mockResolvedValueOnce([]) // day=15: no opps → no alertPreference call
      .mockResolvedValueOnce([opp] as never) // day=7: our opp → triggers alertPreference call
      .mockResolvedValue([]); // day=1: no opps
    vi.mocked(prisma.alertPreference.findMany)
      .mockResolvedValueOnce([pref] as never) // first (and only) call: day=7
      .mockResolvedValue([]);
    vi.mocked(prisma.alert.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([]); // no pending for send step

    const result = await processAlerts(prisma, emailService);

    expect(prisma.alert.create).toHaveBeenCalledOnce();
    expect(prisma.alert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        opportunityId: 'opp-1',
        triggerDays: 7,
        type: 'DAYS_7',
        email: 'osc@example.com',
        status: 'PENDING',
      }),
    });
    expect(result.alertsCreated).toBe(1);
  });

  it('sends an email for each PENDING alert and marks it as SENT', async () => {
    const pendingAlert = makePendingAlert();

    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([]); // no new opps today
    vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([pendingAlert] as never);

    const result = await processAlerts(prisma, emailService);

    expect(emailService.captured).toHaveLength(1);
    expect(emailService.captured[0].to).toBe('osc@example.com');
    expect(emailService.captured[0].templateData.daysLeft).toBe(7);
    expect(emailService.captured[0].templateData.opportunity.title).toBe('Edital Cultural 2025');

    expect(prisma.alert.update).toHaveBeenCalledWith({
      where: { id: 'alert-1' },
      data: expect.objectContaining({ status: 'SENT', sentAt: expect.any(Date) }),
    });

    expect(result.emailsSent).toBe(1);
    expect(result.emailsFailed).toBe(0);
  });

  it('email template data includes unsubscribe URL', async () => {
    const pendingAlert = makePendingAlert();
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([pendingAlert] as never);

    await processAlerts(prisma, emailService);

    const payload = emailService.captured[0];
    expect(payload.templateData.unsubscribeUrl).toContain('/api/alerts/unsubscribe/');
    // URL should contain a 64-char hex token
    const token = payload.templateData.unsubscribeUrl.split('/').pop()!;
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  // ── Area matching ───────────────────────────────────────────────────────

  it('does NOT create alert when org area does not match opportunity areas', async () => {
    const opp = makeOpportunity({ deadline: daysFromNow(7), areas: ['saúde'] });

    vi.mocked(prisma.opportunity.findMany).mockResolvedValueOnce([opp] as never);
    // Prisma query with hasSome would return empty — simulate that
    vi.mocked(prisma.alertPreference.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([]);

    const result = await processAlerts(prisma, emailService);

    expect(prisma.alert.create).not.toHaveBeenCalled();
    expect(result.alertsCreated).toBe(0);
  });

  it('creates alert when preference has empty areas (matches all opportunities)', async () => {
    const opp = makeOpportunity({ deadline: daysFromNow(7), areas: ['saúde'] });
    const pref = makePreference({ areas: [], days: [7] }); // empty = all areas

    vi.mocked(prisma.opportunity.findMany).mockResolvedValueOnce([opp] as never);
    vi.mocked(prisma.alertPreference.findMany).mockResolvedValueOnce([pref] as never);
    vi.mocked(prisma.alert.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([]);

    const result = await processAlerts(prisma, emailService);

    expect(prisma.alert.create).toHaveBeenCalledOnce();
    expect(result.alertsCreated).toBe(1);
  });

  // ── Idempotency ─────────────────────────────────────────────────────────

  it('does NOT create a duplicate alert when one already exists for same org+opp+type', async () => {
    const opp = makeOpportunity({ deadline: daysFromNow(7) });
    const pref = makePreference({ days: [7] });
    const existingAlert = { id: 'alert-existing', status: 'SENT' };

    vi.mocked(prisma.opportunity.findMany).mockResolvedValueOnce([opp] as never);
    vi.mocked(prisma.alertPreference.findMany).mockResolvedValueOnce([pref] as never);
    vi.mocked(prisma.alert.findFirst).mockResolvedValueOnce(existingAlert as never); // already exists
    vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([]);

    const result = await processAlerts(prisma, emailService);

    expect(prisma.alert.create).not.toHaveBeenCalled();
    expect(result.alertsCreated).toBe(0);
  });

  // ── 15-day trigger ──────────────────────────────────────────────────────

  it('creates alert for 15-day trigger when opp deadline is 15 days away', async () => {
    const opp = makeOpportunity({ deadline: daysFromNow(15) });
    const pref = makePreference({ areas: ['cultura'], days: [15] });

    // Only the 15-day findMany call returns data
    vi.mocked(prisma.opportunity.findMany)
      .mockResolvedValueOnce([opp] as never) // day=15
      .mockResolvedValue([]); // day=7, day=1

    vi.mocked(prisma.alertPreference.findMany)
      .mockResolvedValueOnce([pref] as never)
      .mockResolvedValue([]);

    vi.mocked(prisma.alert.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([]);

    const result = await processAlerts(prisma, emailService);

    expect(prisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'DAYS_15', triggerDays: 15 }),
      }),
    );
    expect(result.alertsCreated).toBe(1);
  });

  // ── Email failure handling ──────────────────────────────────────────────

  it('marks alert as FAILED when email send throws', async () => {
    const pendingAlert = makePendingAlert();
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([pendingAlert] as never);

    // Override emailService.batchSend to return failure
    emailService.batchSend = vi
      .fn()
      .mockResolvedValueOnce([{ success: false, error: 'SMTP connection refused' }]);

    const result = await processAlerts(prisma, emailService);

    expect(prisma.alert.update).toHaveBeenCalledWith({
      where: { id: 'alert-1' },
      data: { status: 'FAILED' },
    });

    expect(result.emailsSent).toBe(0);
    expect(result.emailsFailed).toBe(1);
  });

  // ── Graceful error isolation ────────────────────────────────────────────

  it('continues processing remaining trigger days when one day fails', async () => {
    vi.mocked(prisma.opportunity.findMany)
      .mockRejectedValueOnce(new Error('DB timeout')) // fails for day=15
      .mockResolvedValue([]); // succeeds for day=7, day=1

    vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([]);

    const result = await processAlerts(prisma, emailService);

    // Should have one error logged but not thrown
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('15d');
    // And should have continued (no unhandled rejection)
    expect(result.alertsCreated).toBe(0);
  });

  // ── No opportunities today ──────────────────────────────────────────────

  it("returns zero counts when no opportunities match today's triggers", async () => {
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.alert.findMany).mockResolvedValueOnce([]);

    const result = await processAlerts(prisma, emailService);

    expect(prisma.alert.create).not.toHaveBeenCalled();
    expect(emailService.captured).toHaveLength(0);
    expect(result.alertsCreated).toBe(0);
    expect(result.emailsSent).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
