import { describe, it, expect, beforeEach } from 'vitest';
import { TransferegovCollector } from '../transferegov.collector.js';

describe('TransferegovCollector.mapItem', () => {
  let collector: TransferegovCollector;

  const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const PAST_DATE = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    collector = new TransferegovCollector();
  });

  it('maps all fields correctly from a complete raw item', () => {
    const raw = {
      idChamamento: 42,
      nmPrograma: 'Programa Nacional de Cultura',
      dsObjeto: 'Apoio a projetos culturais nas regiões Norte e Nordeste.',
      dtEncerramento: FUTURE_DATE,
      vlMaximo: 500000,
      link: 'https://transferegov.sistema.gov.br/chamamento/42',
      cdFinalidade: ['cultura', 'educacao'],
      nmOrgao: 'Ministério da Cultura',
      urlEdital: 'https://example.gov.br/edital.pdf',
      dsSituacao: 'ABERTO',
    };

    const result = collector.mapItem(raw);

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Programa Nacional de Cultura');
    expect(result!.source).toBe('Transferegov');
    expect(result!.sourceUrl).toBe('https://transferegov.sistema.gov.br/chamamento/42');
    expect(result!.portalUrl).toBe('https://transferegov.sistema.gov.br/chamamento/42');
    expect(result!.value).toBe(500000);
    expect(result!.areas).toEqual(['cultura', 'educação']);
    expect(result!.pdfUrl).toBe('https://example.gov.br/edital.pdf');
    expect(result!.isActive).toBe(true);
    expect(result!.deadline).toBeInstanceOf(Date);
  });

  it('sets source to "Transferegov"', () => {
    const raw = {
      nmPrograma: 'Qualquer Programa',
      dtEncerramento: FUTURE_DATE,
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
    };
    expect(collector.mapItem(raw)!.source).toBe('Transferegov');
  });

  it('returns null when nmPrograma is missing', () => {
    const raw = {
      dtEncerramento: FUTURE_DATE,
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
    };
    expect(collector.mapItem(raw)).toBeNull();
  });

  it('returns null when link is missing', () => {
    const raw = {
      nmPrograma: 'Programa X',
      dtEncerramento: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)).toBeNull();
  });

  it('returns null when dtEncerramento is absent', () => {
    const raw = {
      nmPrograma: 'Programa X',
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
    };
    expect(collector.mapItem(raw)).toBeNull();
  });

  it('returns null when dtEncerramento is an invalid date string', () => {
    const raw = {
      nmPrograma: 'Programa X',
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
      dtEncerramento: 'not-a-date',
    };
    expect(collector.mapItem(raw)).toBeNull();
  });

  it('returns null when deadline is in the past', () => {
    const raw = {
      nmPrograma: 'Programa Expirado',
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
      dtEncerramento: PAST_DATE,
    };
    expect(collector.mapItem(raw)).toBeNull();
  });

  it('handles cdFinalidade as a string (not array)', () => {
    const raw = {
      nmPrograma: 'Programa X',
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
      dtEncerramento: FUTURE_DATE,
      cdFinalidade: 'saude',
    };
    const result = collector.mapItem(raw);
    // AREA_MAP normaliza para a forma canônica acentuada
    expect(result!.areas).toEqual(['saúde']);
  });

  it('deduplicates cdFinalidade entries', () => {
    const raw = {
      nmPrograma: 'Programa X',
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
      dtEncerramento: FUTURE_DATE,
      cdFinalidade: ['cultura', 'CULTURA', 'cultura'],
    };
    const result = collector.mapItem(raw);
    // lowercased + deduped
    expect(result!.areas).toEqual(['cultura']);
  });

  it('defaults value to 0 when vlMaximo is absent', () => {
    const raw = {
      nmPrograma: 'Programa X',
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
      dtEncerramento: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)!.value).toBe(0);
  });

  it('sets pdfUrl to undefined when urlEdital is absent', () => {
    const raw = {
      nmPrograma: 'Programa X',
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
      dtEncerramento: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)!.pdfUrl).toBeUndefined();
  });

  it('includes nmOrgao in summary when present', () => {
    const raw = {
      nmPrograma: 'Programa X',
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
      dtEncerramento: FUTURE_DATE,
      nmOrgao: 'Ministério X',
      dsObjeto: 'Apoiar projetos locais.',
    };
    const result = collector.mapItem(raw);
    expect(result!.summary).toContain('Ministério X');
    expect(result!.summary).toContain('Apoiar projetos locais.');
  });

  it('uses fallback summary when nmOrgao and dsObjeto are absent', () => {
    const raw = {
      nmPrograma: 'Programa X',
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
      dtEncerramento: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)!.summary).toBe('Chamamento público via Portal da Transparência.');
  });

  it('trims whitespace from title and sourceUrl', () => {
    const raw = {
      nmPrograma: '  Programa com espaços  ',
      link: '  https://transferegov.sistema.gov.br/chamamento/1  ',
      dtEncerramento: FUTURE_DATE,
    };
    const result = collector.mapItem(raw);
    expect(result!.title).toBe('Programa com espaços');
    expect(result!.sourceUrl).toBe('https://transferegov.sistema.gov.br/chamamento/1');
  });

  it('returns empty areas array when cdFinalidade is absent', () => {
    const raw = {
      nmPrograma: 'Programa X',
      link: 'https://transferegov.sistema.gov.br/chamamento/1',
      dtEncerramento: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)!.areas).toEqual([]);
  });
});
