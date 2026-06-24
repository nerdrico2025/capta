import OpenAI from 'openai';
import type { PrismaClient } from '@prisma/client';
import { RateLimiter } from '../collectors/rate-limiter.js';
import { parseBrDeadline } from '../lib/deadline.js';

const MODEL = 'gpt-4o-mini';

// 30 calls/min = 0.5 calls/s
const RATE_LIMIT_PER_SEC = 0.5;

export interface EnrichmentInput {
  title: string;
  source: string;
  areas: string[];
  rawDescription: string;
  fullText?: string;
}

export interface EnrichmentOutput {
  summary: string;
  eligibleOrgProfile: string;
  firstSteps: string[];
}

export interface ExtractedOpportunity {
  title: string;
  deadline: Date | null;
  value: number;
  areas: string[];
  type: 'EDITAL' | 'LEI' | 'PRIVADO';
  sourceUrl: string;
  summary: string;
}

export class EnrichmentService {
  private readonly client: OpenAI | null;
  private readonly rateLimiter: RateLimiter;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    this.client = key ? new OpenAI({ apiKey: key }) : null;
    this.rateLimiter = new RateLimiter(RATE_LIMIT_PER_SEC);
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentOutput> {
    if (!this.client) {
      return mockEnrich(input);
    }

    await this.rateLimiter.acquire();

    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildPrompt(input) }],
    });
    const content = response.choices[0].message.content ?? '';

    return parseJson(content, input);
  }

  async enrichOpportunity(
    prisma: PrismaClient,
    opportunityId: string,
    input: EnrichmentInput,
    force = false,
  ): Promise<void> {
    if (!force) {
      const existing = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { aiSummary: true },
      });
      if (existing?.aiSummary) return; // already enriched
    }

    try {
      const output = await this.enrich(input);
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: {
          aiSummary: output.summary,
          eligibleOrgProfile: output.eligibleOrgProfile,
          firstSteps: output.firstSteps,
        },
      });
    } catch (err) {
      // Enrichment failures are non-fatal — log and continue
      console.warn(`[enrichment] Failed for opportunity ${opportunityId}:`, err);
    }
  }

  async extractFromFreeText(
    htmlBlock: string,
    postDate: string,
  ): Promise<ExtractedOpportunity | null> {
    const text = htmlBlock
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!this.client) {
      return extractFromFreeTextFallback(text, postDate);
    }

    await this.rateLimiter.acquire();

    const prompt = `Você é um assistente que extrai dados estruturados de textos sobre editais e chamadas públicas para o terceiro setor brasileiro.

Texto de um edital:
"""
${text.slice(0, 1500)}
"""

Extraia APENAS um JSON válido com esta estrutura (sem markdown):
{
  "title": "título do edital",
  "deadline": "YYYY-MM-DD ou null se não encontrado",
  "value": número em reais (0 se não informado),
  "areas": ["área1", "área2"],
  "type": "EDITAL" ou "PRIVADO" (PRIVADO se for de fundação/empresa privada),
  "sourceUrl": "URL mencionada no texto ou string vazia",
  "summary": "1-2 frases resumindo o edital"
}

Para areas, use APENAS estas opções: educação, saúde, cultura, esporte, meio ambiente, assistência social, segurança alimentar, direitos humanos, desenvolvimento urbano, ciência e tecnologia, trabalho e renda.`;

    try {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = response.choices[0].message.content ?? '';
      const clean = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      const parsed = JSON.parse(clean) as Partial<ExtractedOpportunity> & {
        deadline?: string | null;
      };

      if (!parsed.title?.trim()) return null;

      const deadline = parseBrDeadline(parsed.deadline).date;

      return {
        title: String(parsed.title).trim(),
        deadline,
        value: Number(parsed.value) || 0,
        areas: Array.isArray(parsed.areas) ? parsed.areas.map(String) : [],
        type: parsed.type === 'PRIVADO' ? 'PRIVADO' : 'EDITAL',
        sourceUrl: String(parsed.sourceUrl ?? '').trim(),
        summary: String(parsed.summary ?? '').trim(),
      };
    } catch {
      return extractFromFreeTextFallback(text, postDate);
    }
  }
}

// Singleton — shared across collectors to enforce the global rate limit
export const enrichmentService = new EnrichmentService();

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractFromFreeTextFallback(text: string, _postDate: string): ExtractedOpportunity | null {
  // Título: primeiro trecho antes de ponto ou até 120 chars
  const titleMatch = text.match(/^([^\n.]{10,120})/);
  if (!titleMatch) return null;
  const title = titleMatch[1].trim();

  // Prazo: normalizado via parseBrDeadline (pt-BR variado + timezone BRT→UTC)
  const deadline = parseBrDeadline(text).date;

  // Valor: "R$ X.XXX" ou "até R$ X mil"
  let value = 0;
  const mVal = text.match(/R\$\s*([\d.,]+)\s*(?:mil)?/i);
  if (mVal) {
    const raw = mVal[1].replace(/\./g, '').replace(',', '.');
    value =
      parseFloat(raw) *
      (text.slice(mVal.index ?? 0, (mVal.index ?? 0) + 30).includes('mil') ? 1000 : 1);
  }

  // URL
  const mUrl = text.match(/https?:\/\/[^\s)>]+/);
  const sourceUrl = mUrl ? mUrl[0] : '';

  // Tipo: privado se mencionar fundação/instituto/empresa
  const type: 'EDITAL' | 'PRIVADO' = /fundaç|instituto|empresa|corporat/i.test(text)
    ? 'PRIVADO'
    : 'EDITAL';

  return { title, deadline, value, areas: [], type, sourceUrl, summary: text.slice(0, 200) };
}

function buildPrompt(input: EnrichmentInput): string {
  const text = input.fullText
    ? `${input.rawDescription}\n\nTexto completo:\n${input.fullText.slice(0, 3000)}`
    : input.rawDescription;

  return `Você é um assistente especializado em captação de recursos para o terceiro setor brasileiro.

Dado este edital:
- Título: ${input.title}
- Fonte: ${input.source}
- Áreas: ${input.areas.join(', ') || 'não informado'}
- Descrição: ${text.slice(0, 2000)}

Gere em português APENAS um JSON válido, sem markdown, sem explicações, com esta estrutura:
{
  "summary": "resumo de 3-5 linhas em linguagem simples, sem jargão técnico, explicando O QUE é o edital, QUEM pode se inscrever e ATÉ QUANDO",
  "eligibleOrgProfile": "1-2 frases descrevendo o perfil ideal da organização elegível",
  "firstSteps": ["passo 1", "passo 2", "passo 3"]
}

A lista firstSteps deve ter entre 3 e 5 itens práticos e objetivos para iniciar a candidatura.`;
}

function parseJson(raw: string, input: EnrichmentInput): EnrichmentOutput {
  try {
    // Strip any accidental markdown fences
    const clean = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(clean) as Partial<EnrichmentOutput>;

    return {
      summary: String(parsed.summary ?? '').trim() || fallbackSummary(input),
      eligibleOrgProfile:
        String(parsed.eligibleOrgProfile ?? '').trim() ||
        'Organizações sem fins lucrativos com atuação nas áreas indicadas.',
      firstSteps:
        Array.isArray(parsed.firstSteps) && parsed.firstSteps.length
          ? parsed.firstSteps.map(String)
          : defaultFirstSteps(),
    };
  } catch {
    console.warn('[enrichment] Failed to parse Claude response, using fallback');
    return mockEnrich(input);
  }
}

function mockEnrich(input: EnrichmentInput): EnrichmentOutput {
  return {
    summary: fallbackSummary(input),
    eligibleOrgProfile: 'Organizações sem fins lucrativos com atuação nas áreas indicadas.',
    firstSteps: defaultFirstSteps(),
  };
}

function fallbackSummary(input: EnrichmentInput): string {
  return (
    `${input.title} — Oportunidade de captação via ${input.source}. ` +
    `Áreas: ${input.areas.join(', ') || 'diversas'}. ` +
    `Consulte o portal de origem para detalhes sobre elegibilidade e prazo.`
  );
}

function defaultFirstSteps(): string[] {
  return [
    'Ler o edital completo e verificar requisitos de elegibilidade',
    'Reunir documentação institucional (CNPJ, estatuto, certidões)',
    'Verificar a área de atuação e adequação ao objeto do edital',
    'Contatar o órgão responsável para sanar dúvidas',
    'Iniciar a elaboração do plano de trabalho ou projeto',
  ];
}
