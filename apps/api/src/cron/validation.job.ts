import type { PrismaClient } from '@prisma/client';
import { classifyResponse, type LinkStatus } from '../lib/link-check.js';

const STALE_THRESHOLD_DAYS = 15;
const URL_CHECK_TIMEOUT_MS = 8_000;
const MAX_LINK_CHECKS = 75; // cap de checagens HTTP por run
const LINK_RECHECK_DAYS = 7; // re-checa links não verificados há mais de 7 dias
const MAX_BODY_BYTES = 200_000; // corpo lido para detectar parede de login

type LinkAlertType =
  | 'STALE_DATA'
  | 'SCRAPE_FAILED'
  | 'MISSING_SUMMARY'
  | 'EXPIRED_NOT_DEACTIVATED'
  | 'LINK_REQUIRES_AUTH'
  | 'LINK_RELATIVE';

export interface LinkCheckResult {
  linksChecked: number;
  linksOk: number;
  loginWallsFlagged: number;
  brokenFlagged: number;
  relativeFlagged: number;
  unreachableFlagged: number;
}

export interface ValidationJobResult extends LinkCheckResult {
  expiredDeactivated: number;
  staleAlertsFlagged: number;
  missingAiSummaryFlagged: number;
  errors: string[];
}

export async function runValidationJob(prisma: PrismaClient): Promise<ValidationJobResult> {
  const result: ValidationJobResult = {
    expiredDeactivated: 0,
    staleAlertsFlagged: 0,
    missingAiSummaryFlagged: 0,
    linksChecked: 0,
    linksOk: 0,
    loginWallsFlagged: 0,
    brokenFlagged: 0,
    relativeFlagged: 0,
    unreachableFlagged: 0,
    errors: [],
  };

  // ── 1. Deactivate opportunities past their deadline ───────────────────────
  try {
    const { count } = await prisma.opportunity.updateMany({
      where: { isActive: true, deadline: { lt: new Date() } },
      data: { isActive: false, isOpen: false },
    });
    result.expiredDeactivated = count;
    if (count > 0) console.log(`[validation] Deactivated ${count} expired opportunity/ies`);
  } catch (err) {
    const msg = `deactivateExpired: ${errMsg(err)}`;
    result.errors.push(msg);
    console.error(`[validation] ${msg}`);
  }

  // ── 2. Flag stale active opportunities (not updated in >N days) ───────────
  const staleThreshold = daysAgo(STALE_THRESHOLD_DAYS);
  try {
    const stale = await prisma.opportunity.findMany({
      where: { isActive: true, updatedAt: { lt: staleThreshold } },
      select: { id: true, source: true },
      take: MAX_LINK_CHECKS,
    });
    for (const opp of stale) {
      const created = await ensureDataAlert(
        prisma,
        opp.id,
        'STALE_DATA',
        `Não atualizado há mais de ${STALE_THRESHOLD_DAYS} dias (fonte: ${opp.source})`,
      );
      if (created) result.staleAlertsFlagged++;
    }
  } catch (err) {
    const msg = `staleFlag: ${errMsg(err)}`;
    result.errors.push(msg);
    console.error(`[validation] ${msg}`);
  }

  // ── 3. Link health check (escopo ampliado: stale ∪ não-checados há >7d) ────
  try {
    const linkResult = await checkOpportunityLinks(prisma);
    Object.assign(result, linkResult);
  } catch (err) {
    const msg = `linkCheck: ${errMsg(err)}`;
    result.errors.push(msg);
    console.error(`[validation] ${msg}`);
  }

  // ── 4. Flag active opportunities missing AI summary ───────────────────────
  try {
    const missing = await prisma.opportunity.findMany({
      where: { isActive: true, aiSummary: null },
      select: { id: true },
    });
    for (const opp of missing) {
      const created = await ensureDataAlert(
        prisma,
        opp.id,
        'MISSING_SUMMARY',
        'Resumo de IA não gerado',
      );
      if (created) result.missingAiSummaryFlagged++;
    }
  } catch (err) {
    const msg = `missingSummary: ${errMsg(err)}`;
    result.errors.push(msg);
    console.error(`[validation] ${msg}`);
  }

  return result;
}

/**
 * Verifica a saúde dos links: itens ativos que estão stale (>15d) OU cujo
 * linkCheckedAt é nulo / mais antigo que 7 dias. Detecta paredes de login,
 * 404/5xx, URLs relativas legadas, e marca linkStatus + linkCheckedAt.
 * Exportada para teste isolado.
 */
export async function checkOpportunityLinks(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<LinkCheckResult> {
  const r: LinkCheckResult = {
    linksChecked: 0,
    linksOk: 0,
    loginWallsFlagged: 0,
    brokenFlagged: 0,
    relativeFlagged: 0,
    unreachableFlagged: 0,
  };

  const staleThreshold = new Date(now.getTime() - STALE_THRESHOLD_DAYS * 86_400_000);
  const recheckThreshold = new Date(now.getTime() - LINK_RECHECK_DAYS * 86_400_000);

  const toCheck = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      OR: [
        { updatedAt: { lt: staleThreshold } },
        { linkCheckedAt: null },
        { linkCheckedAt: { lt: recheckThreshold } },
      ],
    },
    select: { id: true, sourceUrl: true },
    orderBy: { linkCheckedAt: { sort: 'asc', nulls: 'first' } },
    take: MAX_LINK_CHECKS,
  });

  await Promise.allSettled(toCheck.map((opp) => checkOneLink(prisma, opp, now, r)));
  return r;
}

async function checkOneLink(
  prisma: PrismaClient,
  opp: { id: string; sourceUrl: string },
  now: Date,
  r: LinkCheckResult,
): Promise<void> {
  // URL relativa/não-http (legado, anterior à guarda de ingestão).
  if (!/^https?:\/\//i.test(opp.sourceUrl)) {
    await ensureDataAlert(
      prisma,
      opp.id,
      'LINK_RELATIVE',
      `sourceUrl não-absoluta: "${opp.sourceUrl}"`,
    );
    await markLink(prisma, opp.id, 'RELATIVE', now);
    r.relativeFlagged++;
    return;
  }

  r.linksChecked++;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), URL_CHECK_TIMEOUT_MS);

    const res = await fetch(opp.sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'CaptaBot/1.0 (+https://capta.app)' },
    });

    const contentType = res.headers.get('content-type');
    // Lê o corpo (limitado) só se for HTML e 2xx — login só existe em HTML.
    let body = '';
    if (res.status < 400 && contentType && /text\/html|application\/xhtml/i.test(contentType)) {
      body = (await res.text()).slice(0, MAX_BODY_BYTES);
    }
    clearTimeout(timeout);

    const cls = classifyResponse(res.status, res.url, contentType, body);

    if (cls === 'OK') {
      await markLink(prisma, opp.id, 'OK', now);
      await resolveOpenAlerts(prisma, opp.id);
      r.linksOk++;
    } else if (cls === 'REQUIRES_AUTH') {
      await ensureDataAlert(
        prisma,
        opp.id,
        'LINK_REQUIRES_AUTH',
        `Parede de login detectada (HTTP ${res.status})`,
      );
      await markLink(prisma, opp.id, 'REQUIRES_AUTH', now);
      r.loginWallsFlagged++;
    } else {
      await ensureDataAlert(prisma, opp.id, 'SCRAPE_FAILED', `URL retornou HTTP ${res.status}`);
      await markLink(prisma, opp.id, 'BROKEN', now);
      r.brokenFlagged++;
    }
  } catch {
    await ensureDataAlert(
      prisma,
      opp.id,
      'SCRAPE_FAILED',
      'URL inacessível (timeout ou erro de rede)',
    );
    await markLink(prisma, opp.id, 'UNREACHABLE', now);
    r.unreachableFlagged++;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function markLink(
  prisma: PrismaClient,
  id: string,
  linkStatus: LinkStatus,
  now: Date,
): Promise<void> {
  await prisma.opportunity.update({
    where: { id },
    data: { linkStatus, linkCheckedAt: now },
  });
}

// Resolve alertas de link/staleness abertos quando a URL volta a ficar saudável.
async function resolveOpenAlerts(prisma: PrismaClient, opportunityId: string): Promise<void> {
  await prisma.dataAlert.updateMany({
    where: {
      opportunityId,
      resolvedAt: null,
      type: { in: ['STALE_DATA', 'SCRAPE_FAILED', 'LINK_REQUIRES_AUTH', 'LINK_RELATIVE'] },
    },
    data: { resolvedAt: new Date(), message: 'URL verificada e acessível' },
  });
}

/** Cria um DataAlert aberto se ainda não houver um do mesmo tipo. Retorna se criou. */
async function ensureDataAlert(
  prisma: PrismaClient,
  opportunityId: string,
  type: LinkAlertType,
  message: string,
): Promise<boolean> {
  const existing = await prisma.dataAlert.findFirst({
    where: { opportunityId, type, resolvedAt: null },
  });
  if (existing) return false;
  await prisma.dataAlert.create({ data: { opportunityId, type, message } });
  return true;
}
