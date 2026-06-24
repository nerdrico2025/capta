import { describe, it, expect, beforeEach } from 'vitest';
import { SalicCollector } from '../salic.collector.js';

// Tests reflect the new SALIC API v2 format:
//   - segmento: flat string (was { codigo, descricao })
//   - proponente: flat string (was { nome, tipo_pessoa })
//   - sourceUrl: derived from PRONAC (API no longer provides url_projeto)
//   - SALIC_PORTAL_BASE uses https://

describe('SalicCollector.mapItem', () => {
  let collector: SalicCollector;

  const FUTURE_DATE = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // YYYY-MM-DD
  const PAST_DATE = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  beforeEach(() => {
    collector = new SalicCollector();
  });

  it('maps all fields correctly from a complete raw item', () => {
    const raw = {
      PRONAC: '241234',
      nome: 'Festival de Artes Cênicas do Nordeste',
      data_termino: FUTURE_DATE,
      segmento: 'Artes Cênicas',
      valor_proposta: 120000,
      situacao: 'Em captação',
      proponente: 'Associação Cultural Nordestina',
      resumo: 'Realização do festival anual de artes cênicas.',
      UF: 'CE',
      municipio: 'Fortaleza',
    };

    const result = collector.mapItem(raw);

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Festival de Artes Cênicas do Nordeste');
    expect(result!.source).toBe('SALIC');
    expect(result!.sourceUrl).toBe('https://salic.cultura.gov.br/projeto/241234');
    expect(result!.portalUrl).toBe('https://salic.cultura.gov.br/projeto/241234');
    expect(result!.value).toBe(120000);
    expect(result!.areas).toContain('cultura');
    expect(result!.isActive).toBe(true);
    expect(result!.deadline).toBeInstanceOf(Date);
  });

  it('sets source to "SALIC"', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)!.source).toBe('SALIC');
  });

  it('returns null when nome is missing', () => {
    const raw = {
      PRONAC: '001',
      data_termino: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)).toBeNull();
  });

  it('returns null when PRONAC is missing', () => {
    const raw = {
      nome: 'Projeto sem PRONAC',
      data_termino: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)).toBeNull();
  });

  it('returns null when data_termino is absent', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
    };
    expect(collector.mapItem(raw)).toBeNull();
  });

  it('returns null when data_termino is an invalid date', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: 'not-a-date',
    };
    expect(collector.mapItem(raw)).toBeNull();
  });

  it('returns null when deadline is in the past', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Expirado',
      data_termino: PAST_DATE,
    };
    expect(collector.mapItem(raw)).toBeNull();
  });

  it('constructs sourceUrl from PRONAC (https portal base)', () => {
    const raw = {
      PRONAC: '999888',
      nome: 'Projeto Sem URL',
      data_termino: FUTURE_DATE,
    };
    const result = collector.mapItem(raw);
    expect(result!.sourceUrl).toBe('https://salic.cultura.gov.br/projeto/999888');
  });

  it('uses valor_solicitado as fallback when valor_proposta is absent', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: FUTURE_DATE,
      valor_solicitado: 75000,
    };
    expect(collector.mapItem(raw)!.value).toBe(75000);
  });

  it('parses valor_proposta as string (v2 API returns strings)', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: FUTURE_DATE,
      valor_proposta: '2553756',
    };
    expect(collector.mapItem(raw)!.value).toBe(2553756);
  });

  it('defaults value to 0 when all value fields are absent', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)!.value).toBe(0);
  });

  it('infers "cultura" area from music-related segmento', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: FUTURE_DATE,
      segmento: 'Teatro Musical (c/ dramaturgia, danças e canções)',
    };
    const result = collector.mapItem(raw);
    expect(result!.areas).toContain('cultura');
  });

  it('infers "cultura" area from artes cênicas segmento', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: FUTURE_DATE,
      segmento: 'Artes Cênicas',
    };
    expect(collector.mapItem(raw)!.areas).toContain('cultura');
  });

  it('always returns ["cultura"] (Lei Rouanet financia só projetos culturais)', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)!.areas).toEqual(['cultura']);
  });

  it('includes flat proponente string in summary', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: FUTURE_DATE,
      proponente: 'Fulano Silva',
      resumo: 'Projeto de música regional.',
    };
    const result = collector.mapItem(raw);
    expect(result!.summary).toContain('Fulano Silva');
    expect(result!.summary).toContain('Projeto de música regional.');
  });

  it('prefers sinopse over resumo in summary', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: FUTURE_DATE,
      proponente: 'Proponente X',
      resumo: 'Resumo longo.',
      sinopse: 'Sinopse curta.',
    };
    expect(collector.mapItem(raw)!.summary).toContain('Sinopse curta.');
    expect(collector.mapItem(raw)!.summary).not.toContain('Resumo longo.');
  });

  it('uses fallback summary when proponente and resumo are absent', () => {
    const raw = {
      PRONAC: '001',
      nome: 'Projeto Y',
      data_termino: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)!.summary).toBe('Projeto cultural via SALIC — Lei Rouanet.');
  });

  it('trims whitespace from title', () => {
    const raw = {
      PRONAC: '001',
      nome: '  Projeto com espaços  ',
      data_termino: FUTURE_DATE,
    };
    expect(collector.mapItem(raw)!.title).toBe('Projeto com espaços');
  });
});
