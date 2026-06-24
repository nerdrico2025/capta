/**
 * classification.service.ts — rotula cada item ingerido como EDITAL_OFICIAL,
 * MATERIA (notícia/release/blog) ou INDEFINIDO.
 *
 * Camada 1 (regras, barata, sem rede): URL, estrutura HTML e autoridade.
 * Camada 2 (LLM, só para INDEFINIDO): pergunta determinística ao gpt-4o-mini.
 */
import OpenAI from 'openai';
import { load } from 'cheerio';
import { RateLimiter } from '../collectors/rate-limiter.js';
import { isEditalUrl, isPressUrl, isPressDomain } from '../lib/url-patterns.js';

const MODEL = 'gpt-4o-mini';
const RATE_LIMIT_PER_SEC = 0.5;
const DEFAULT_MIN_CONFIDENCE = 0.7;

export type ClassLabel = 'EDITAL_OFICIAL' | 'MATERIA' | 'INDEFINIDO';

export interface ClassifyInput {
  sourceUrl: string;
  portalUrl?: string;
  title: string;
  summary?: string;
  rawContent?: string; // HTML do bloco/página, quando disponível
  pdfUrl?: string;
  source: string;
  sourceType: string; // 'api' | 'scraper' | 'manual'
}

export interface ClassifyResult {
  label: ClassLabel;
  score: number; // confiança 0..1 no label
  reason: string;
  via: 'rules' | 'llm';
}

/** Limiar de confiança para servir EDITAL_OFICIAL (env, default 0.7). */
export function getMinConfidence(): number {
  const raw = Number(process.env.CLASSIFIER_MIN_CONFIDENCE);
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : DEFAULT_MIN_CONFIDENCE;
}

/** Aplica o limiar: EDITAL_OFICIAL abaixo do limiar vira INDEFINIDO (revisão). */
export function gateClassification(result: ClassifyResult, minConfidence: number): ClassLabel {
  if (result.label === 'EDITAL_OFICIAL' && result.score < minConfidence) return 'INDEFINIDO';
  return result.label;
}

// ─── Camada 1: regras ───────────────────────────────────────────────────────

const clamp = (x: number): number => Math.min(0.97, Math.max(0, x));

/** Conta marcadores estruturais de edital × de matéria no HTML. */
export function structureSignals(rawContent: string): { edital: number; press: number } {
  let edital = 0;
  let press = 0;

  const $ = load(rawContent);
  const text = $.root().text().replace(/\s+/g, ' ').toLowerCase();

  // Positivos (estrutura de edital oficial)
  if (/\bobjeto\b/.test(text)) edital++;
  if (/prazo de inscri|inscri[çc][õo]es at[ée]|per[ií]odo de inscri/.test(text)) edital++;
  if (/\banexos?\b|anexo\s+i\b/.test(text)) edital++;
  if (/edital\s+n[º°o.\s]/.test(text)) edital++;
  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') ?? '').toLowerCase();
    if (href.endsWith('.pdf') && /edital|chamamento|selecao|sele[çc][aã]o|anexo/.test(href))
      edital++;
  });

  // Negativos (estrutura jornalística)
  if (/reda[çc][ãa]o\b|por\s+reda[çc]/.test(text)) press++;
  if (/publicado em|atualizado em|publicado por/.test(text)) press++;
  if (/leia (mais|tamb[ée]m)/.test(text)) press++;
  if (/compartilh/.test(text)) press++;
  if ($('.byline, .author, [rel="author"], .share, .social-share, .post-meta').length > 0) press++;

  return { edital, press };
}

export function classifyByRules(input: ClassifyInput): ClassifyResult {
  const url = (input.sourceUrl || '').toLowerCase();
  const reasons: string[] = [];

  let editalStrong = 0;
  let pressStrong = 0;

  if (isEditalUrl(url)) {
    editalStrong++;
    reasons.push('url:edital');
  }
  if (input.sourceType === 'api' || input.sourceType === 'manual') {
    editalStrong++;
    reasons.push(`fonte:${input.sourceType}`);
  }
  if (isPressUrl(url)) {
    pressStrong++;
    reasons.push('url:imprensa');
  }
  if (isPressDomain(url)) {
    pressStrong++;
    reasons.push('dominio:imprensa');
  }

  if (input.rawContent) {
    const s = structureSignals(input.rawContent);
    if (s.edital >= 2) {
      editalStrong++;
      reasons.push(`estrutura:edital(${s.edital})`);
    }
    if (s.press >= 2) {
      pressStrong++;
      reasons.push(`estrutura:imprensa(${s.press})`);
    }
  }

  // Título é sinal FRACO (notícias também citam "edital"): só ajusta score.
  const titleEdital = /\b(edital|chamamento|chamada p[úu]blica|sele[çc][ãa]o p[úu]blica)\b/i.test(
    input.title,
  );

  const reason = reasons.join(',') || 'sem-sinais';

  if (editalStrong > 0 && pressStrong === 0) {
    return {
      label: 'EDITAL_OFICIAL',
      score: clamp(0.7 + 0.1 * (editalStrong - 1) + (titleEdital ? 0.05 : 0)),
      reason,
      via: 'rules',
    };
  }
  if (pressStrong > 0 && editalStrong === 0) {
    return { label: 'MATERIA', score: clamp(0.7 + 0.1 * (pressStrong - 1)), reason, via: 'rules' };
  }
  // Sinais conflitantes ou ausentes → INDEFINIDO (camada LLM decide).
  return {
    label: 'INDEFINIDO',
    score: editalStrong || pressStrong ? 0.5 : 0.45,
    reason,
    via: 'rules',
  };
}

// ─── Camada 2: LLM ──────────────────────────────────────────────────────────

export class ClassificationService {
  private readonly client: OpenAI | null;
  private readonly rateLimiter: RateLimiter;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    this.client = key ? new OpenAI({ apiKey: key }) : null;
    this.rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);
  }

  async classifyItem(input: ClassifyInput): Promise<ClassifyResult> {
    const rules = classifyByRules(input);
    if (rules.label !== 'INDEFINIDO' || !this.client) return rules;
    const llm = await this.classifyWithLlm(input);
    return llm ?? rules;
  }

  private async classifyWithLlm(input: ClassifyInput): Promise<ClassifyResult | null> {
    if (!this.client) return null;
    try {
      await this.rateLimiter.acquire();
      const snippet = (
        input.rawContent ? load(input.rawContent).root().text() : (input.summary ?? '')
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1200);

      const response = await this.client.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_tokens: 80,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content:
              `Classifique a página do terceiro setor brasileiro abaixo. Ela É o edital/` +
              `chamamento OFICIAL (página/documento oficial de inscrição), ou é um CONTEÚDO ` +
              `SOBRE um edital (notícia, release, blog)?\n\n` +
              `Título: ${input.title}\nURL: ${input.sourceUrl}\nTrecho: """${snippet}"""\n\n` +
              `Responda APENAS JSON: {"label":"EDITAL_OFICIAL"|"MATERIA"|"INDEFINIDO","confidence":0..1}`,
          },
        ],
      });

      const raw = response.choices[0].message.content ?? '';
      const parsed = JSON.parse(raw) as { label?: string; confidence?: number };
      const label = normalizeLabel(parsed.label);
      if (!label) return null;
      const confidence = Number(parsed.confidence);
      return {
        label,
        score: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
        reason: 'llm',
        via: 'llm',
      };
    } catch {
      return null;
    }
  }
}

function normalizeLabel(raw: string | undefined): ClassLabel | null {
  const v = (raw ?? '').toUpperCase();
  if (v === 'EDITAL_OFICIAL' || v === 'MATERIA' || v === 'INDEFINIDO') return v;
  return null;
}

// Singleton compartilhado (rate limit global).
export const classificationService = new ClassificationService();
