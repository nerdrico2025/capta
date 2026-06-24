import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyByRules,
  structureSignals,
  gateClassification,
  type ClassifyInput,
} from '../classification.service.js';

const editalHtml = readFileSync(new URL('./fixtures/edital-oficial.html', import.meta.url), 'utf8');
const materiaHtml = readFileSync(
  new URL('./fixtures/materia-noticia.html', import.meta.url),
  'utf8',
);

function input(overrides: Partial<ClassifyInput>): ClassifyInput {
  return {
    sourceUrl: 'https://x.org/p/1',
    title: 'Item',
    source: 'TEST',
    sourceType: 'scraper',
    ...overrides,
  };
}

describe('classifyByRules — fixtures (edital oficial × matéria)', () => {
  it('classifica a página de edital oficial como EDITAL_OFICIAL', () => {
    const r = classifyByRules(
      input({
        sourceUrl: 'https://www.gov.br/cultura/editais/edital-cultura-2026',
        title: 'Edital nº 03/2026 — Fomento à Cultura',
        rawContent: editalHtml,
      }),
    );
    expect(r.label).toBe('EDITAL_OFICIAL');
    expect(r.score).toBeGreaterThanOrEqual(0.7);
  });

  it('classifica a notícia sobre o mesmo edital como MATERIA', () => {
    const r = classifyByRules(
      input({
        sourceUrl: 'https://www.gov.br/cultura/noticias/governo-lanca-edital',
        title: 'Governo lança novo edital de fomento à cultura',
        rawContent: materiaHtml,
      }),
    );
    expect(r.label).toBe('MATERIA');
    expect(r.score).toBeGreaterThanOrEqual(0.7);
  });
});

describe('structureSignals', () => {
  it('conta marcadores de edital na página oficial (>=2)', () => {
    const s = structureSignals(editalHtml);
    expect(s.edital).toBeGreaterThanOrEqual(2);
    expect(s.press).toBe(0);
  });

  it('conta marcadores de imprensa na notícia (>=2) e nenhum de edital', () => {
    const s = structureSignals(materiaHtml);
    expect(s.press).toBeGreaterThanOrEqual(2);
    expect(s.edital).toBe(0);
  });
});

describe('classifyByRules — sinais isolados', () => {
  it('URL de imprensa força MATERIA', () => {
    const r = classifyByRules(input({ sourceUrl: 'https://fund.org/blog/post-1' }));
    expect(r.label).toBe('MATERIA');
  });

  it('domínio de veículo de imprensa força MATERIA', () => {
    const r = classifyByRules(input({ sourceUrl: 'https://g1.globo.com/cultura/edital' }));
    expect(r.label).toBe('MATERIA');
  });

  it('fonte API é tratada como oficial', () => {
    const r = classifyByRules(input({ sourceType: 'api', sourceUrl: 'https://api.gov/x/1' }));
    expect(r.label).toBe('EDITAL_OFICIAL');
  });

  it('sinais conflitantes (url edital + estrutura imprensa) → INDEFINIDO', () => {
    const r = classifyByRules(
      input({ sourceUrl: 'https://fund.org/editais/x', rawContent: materiaHtml }),
    );
    expect(r.label).toBe('INDEFINIDO');
  });

  it('sem sinais fortes → INDEFINIDO (vai para LLM/revisão)', () => {
    const r = classifyByRules(input({ sourceUrl: 'https://fund.org/p/123' }));
    expect(r.label).toBe('INDEFINIDO');
  });
});

describe('gateClassification — limiar', () => {
  const base = { reason: 'x', via: 'rules' as const };

  it('EDITAL_OFICIAL acima do limiar permanece', () => {
    expect(gateClassification({ label: 'EDITAL_OFICIAL', score: 0.8, ...base }, 0.7)).toBe(
      'EDITAL_OFICIAL',
    );
  });

  it('EDITAL_OFICIAL abaixo do limiar é rebaixado a INDEFINIDO', () => {
    expect(gateClassification({ label: 'EDITAL_OFICIAL', score: 0.6, ...base }, 0.7)).toBe(
      'INDEFINIDO',
    );
  });

  it('MATERIA não é afetada pelo limiar', () => {
    expect(gateClassification({ label: 'MATERIA', score: 0.5, ...base }, 0.7)).toBe('MATERIA');
  });
});
