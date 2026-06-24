/**
 * deadline.ts — normalização de prazos pt-BR.
 *
 * Parseia datas em formatos heterogêneos ("30/06/2026", "até 30 de junho de
 * 2026", "encerramento 30/06 23h59", "inscrições até 15/07", ISO) e SEMPRE
 * interpreta o horário em America/Sao_Paulo, persistindo em UTC.
 *
 * Regras:
 *  - Sem horário explícito ⇒ fim do dia (23:59:59 BRT) — prazo expira no fim do dia.
 *  - Sem ano ⇒ assume o próximo ano em que a data ainda é futura (BRT).
 *  - Texto livre cai no chrono-node com locale pt.
 */
import * as chrono from 'chrono-node';
import { DateTime } from 'luxon';

export const APP_TZ = 'America/Sao_Paulo';

export type DeadlineConfidence = 'high' | 'medium' | 'none';

export interface ParsedDeadline {
  /** Instante em UTC; null se nada parseável. */
  date: Date | null;
  confidence: DeadlineConfidence;
  /** Trecho de texto que casou (debug). */
  matched?: string;
}

interface Components {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  hasTime: boolean;
}

/** Monta o instante em America/Sao_Paulo e converte para UTC. */
function toUtc(c: Components): Date | null {
  const dt = DateTime.fromObject(
    {
      year: c.year,
      month: c.month,
      day: c.day,
      hour: c.hasTime ? (c.hour ?? 0) : 23,
      minute: c.hasTime ? (c.minute ?? 0) : 59,
      second: c.hasTime ? (c.second ?? 0) : 59,
    },
    { zone: APP_TZ },
  );
  return dt.isValid ? dt.toUTC().toJSDate() : null;
}

/** Ano provável para datas sem ano: o próximo em que a data ainda é futura. */
function inferYear(month: number, day: number, now = DateTime.now().setZone(APP_TZ)): number {
  const candidate = DateTime.fromObject({ year: now.year, month, day }, { zone: APP_TZ });
  if (candidate.isValid && candidate.endOf('day') < now) return now.year + 1;
  return now.year;
}

/** Extrai um horário "23h59" / "23:59" / "23h" do texto, se houver. */
function extractTime(text: string): { hour?: number; minute?: number; hasTime: boolean } {
  const m = text.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})?\b/);
  if (!m) return { hasTime: false };
  const hour = Number(m[1]);
  const minute = m[2] !== undefined ? Number(m[2]) : 0;
  if (hour > 23 || minute > 59) return { hasTime: false };
  return { hour, minute, hasTime: true };
}

export function parseBrDeadline(input: string | null | undefined): ParsedDeadline {
  if (!input) return { date: null, confidence: 'none' };
  const text = input.trim();
  if (!text) return { date: null, confidence: 'none' };

  // 0. ISO-8601 com hora. Com timezone explícito (Z/offset) ⇒ instante absoluto
  // (respeita a fonte, não reinterpreta em BRT); sem timezone ⇒ componentes em BRT.
  const isoDt = text.match(
    /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?/,
  );
  if (isoDt) {
    if (isoDt[7]) {
      const d = new Date(isoDt[0]);
      if (!isNaN(d.getTime())) return { date: d, confidence: 'high', matched: isoDt[0] };
    } else {
      const date = toUtc({
        year: Number(isoDt[1]),
        month: Number(isoDt[2]),
        day: Number(isoDt[3]),
        hour: Number(isoDt[4]),
        minute: Number(isoDt[5]),
        second: isoDt[6] ? Number(isoDt[6]) : 0,
        hasTime: true,
      });
      if (date) return { date, confidence: 'high', matched: isoDt[0] };
    }
  }

  const time = extractTime(text);

  // 1. ISO date-only (YYYY-MM-DD, sem hora) ⇒ fim do dia BRT
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const date = toUtc({
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      ...time,
    });
    if (date) return { date, confidence: 'high', matched: iso[0] };
  }

  // 2. DD/MM/AAAA (ou DD/MM/AA)
  const full = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (full) {
    let year = Number(full[3]);
    if (year < 100) year += 2000;
    const date = toUtc({ year, month: Number(full[2]), day: Number(full[1]), ...time });
    if (date) return { date, confidence: 'high', matched: full[0] };
  }

  // 3. DD/MM (sem ano) — infere o ano
  const partial = text.match(/\b(\d{1,2})\/(\d{1,2})(?!\/?\d)/);
  if (partial) {
    const day = Number(partial[1]);
    const month = Number(partial[2]);
    const date = toUtc({ year: inferYear(month, day), month, day, ...time });
    if (date) return { date, confidence: 'medium', matched: partial[0] };
  }

  // 4. Texto livre pt-BR (chrono): "até 30 de junho de 2026"
  const results = chrono.pt.parse(text, new Date(), { forwardDate: true });
  if (results.length > 0) {
    const c = results[0].start;
    const year = c.get('year');
    const month = c.get('month');
    const day = c.get('day');
    if (year && month && day) {
      const hasTime = c.isCertain('hour');
      const date = toUtc({
        year,
        month,
        day,
        hour: c.get('hour') ?? undefined,
        minute: c.get('minute') ?? undefined,
        hasTime,
      });
      if (date) return { date, confidence: 'medium', matched: results[0].text };
    }
  }

  return { date: null, confidence: 'none' };
}

/** Marcadores textuais de "encerrado" no status cru da fonte. */
const CLOSED_RE = /encerrad|fechad|finaliz|conclu[ií]d|expirad|indispon[ií]vel/i;

export function isSourceClosed(sourceStatus?: string | null): boolean {
  return !!sourceStatus && CLOSED_RE.test(sourceStatus);
}

/**
 * Derivado esta_aberto (item 4): (now < submissionDeadline) AND (status != encerrado).
 * Sem prazo de submissão conhecido ⇒ NÃO aberto (não servir registro incerto).
 */
export function computeIsOpen(
  submissionDeadline: Date | null | undefined,
  sourceStatus?: string | null,
  now: Date = new Date(),
): boolean {
  if (isSourceClosed(sourceStatus)) return false;
  if (!submissionDeadline) return false;
  return submissionDeadline.getTime() > now.getTime();
}
