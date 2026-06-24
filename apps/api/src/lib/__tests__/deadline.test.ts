import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { parseBrDeadline, computeIsOpen, isSourceClosed, APP_TZ } from '../deadline.js';

/** Converte o Date (UTC) de volta para America/Sao_Paulo para asserts legíveis. */
function inBrt(date: Date | null) {
  expect(date).not.toBeNull();
  return DateTime.fromJSDate(date as Date).setZone(APP_TZ);
}

describe('parseBrDeadline — formatos pt-BR', () => {
  it('parseia DD/MM/AAAA (fim do dia por padrão)', () => {
    const brt = inBrt(parseBrDeadline('30/06/2026').date);
    expect([brt.year, brt.month, brt.day]).toEqual([2026, 6, 30]);
    expect([brt.hour, brt.minute, brt.second]).toEqual([23, 59, 59]);
  });

  it('parseia "até 30 de junho de 2026" (texto livre)', () => {
    const brt = inBrt(parseBrDeadline('inscrições até 30 de junho de 2026').date);
    expect([brt.year, brt.month, brt.day]).toEqual([2026, 6, 30]);
    expect(brt.hour).toBe(23);
  });

  it('parseia "encerramento 30/06 23h59" (DD/MM + hora, infere ano)', () => {
    const brt = inBrt(parseBrDeadline('encerramento 30/06 23h59').date);
    expect([brt.month, brt.day]).toEqual([6, 30]);
    expect([brt.hour, brt.minute]).toEqual([23, 59]);
  });

  it('parseia "inscrições até 15/07" (sem ano → infere ano futuro, fim do dia)', () => {
    const brt = inBrt(parseBrDeadline('inscrições até 15/07').date);
    expect([brt.month, brt.day]).toEqual([7, 15]);
    expect([brt.hour, brt.minute]).toEqual([23, 59]);
    expect(brt.year).toBeGreaterThanOrEqual(DateTime.now().setZone(APP_TZ).year);
  });

  it('parseia ISO YYYY-MM-DD (saída do LLM)', () => {
    const brt = inBrt(parseBrDeadline('2026-07-15').date);
    expect([brt.year, brt.month, brt.day]).toEqual([2026, 7, 15]);
  });

  it('retorna null para texto sem data', () => {
    expect(parseBrDeadline('edital sem prazo informado').date).toBeNull();
    expect(parseBrDeadline('').date).toBeNull();
    expect(parseBrDeadline(null).date).toBeNull();
  });
});

describe('parseBrDeadline — timezone (BRT America/Sao_Paulo, UTC-3 → UTC)', () => {
  it('edital que fecha hoje 23h59 BRT persiste em UTC no dia seguinte 02:59', () => {
    // 2026-06-30 23:59 BRT == 2026-07-01 02:59 UTC
    const date = parseBrDeadline('30/06/2026 23h59').date;
    expect(date?.toISOString()).toBe('2026-07-01T02:59:00.000Z');
  });

  it('fim de dia (sem hora) vira 02:59:59 UTC do dia seguinte', () => {
    const date = parseBrDeadline('30/06/2026').date;
    expect(date?.toISOString()).toBe('2026-07-01T02:59:59.000Z');
  });
});

describe('computeIsOpen — submissão x execução e status', () => {
  const future = new Date(Date.now() + 30 * 86_400_000);
  const past = new Date(Date.now() - 30 * 86_400_000);

  it('usa o prazo de SUBMISSÃO, não o de execução', () => {
    // Submissão vencida, execução futura → FECHADO (deriva da submissão).
    expect(computeIsOpen(past)).toBe(false);
    // Submissão futura → ABERTO (independe da execução, que nem entra aqui).
    expect(computeIsOpen(future)).toBe(true);
  });

  it('status "encerrado" da fonte fecha mesmo com prazo futuro', () => {
    expect(computeIsOpen(future, 'ENCERRADO')).toBe(false);
    expect(computeIsOpen(future, 'Inscrições encerradas')).toBe(false);
    expect(computeIsOpen(future, 'ABERTO')).toBe(true);
  });

  it('sem prazo de submissão conhecido → não aberto', () => {
    expect(computeIsOpen(null)).toBe(false);
    expect(computeIsOpen(undefined)).toBe(false);
  });

  it('isSourceClosed reconhece variações pt-BR', () => {
    expect(isSourceClosed('ENCERRADO')).toBe(true);
    expect(isSourceClosed('finalizado')).toBe(true);
    expect(isSourceClosed('ABERTO')).toBe(false);
    expect(isSourceClosed(null)).toBe(false);
  });
});
