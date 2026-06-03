import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnrichmentService } from '../enrichment.service.js';
import type { EnrichmentInput } from '../enrichment.service.js';
import type { PrismaClient } from '@prisma/client';

// ─── Mock OpenAI SDK ─────────────────────────────────────────────────────────

vi.mock('openai', () => {
  const create = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create } },
    })),
    __mockCreate: create,
  };
});

async function getMockCreate() {
  const mod = await import('openai');
  return (mod as unknown as { __mockCreate: ReturnType<typeof vi.fn> }).__mockCreate;
}

function makeInput(overrides: Partial<EnrichmentInput> = {}): EnrichmentInput {
  return {
    title: 'Chamamento Público — Cultura Digital 2025',
    source: 'Transferegov',
    areas: ['cultura', 'tecnologia'],
    rawDescription: 'Apoio a projetos de cultura digital em municípios de baixo IDH.',
    ...overrides,
  };
}

function apiResponse(json: object) {
  return {
    choices: [{ message: { content: JSON.stringify(json) } }],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EnrichmentService', () => {
  describe('without API key (mock mode)', () => {
    let service: EnrichmentService;

    beforeEach(() => {
      service = new EnrichmentService(undefined); // no key → mock mode
    });

    it('returns a fallback summary containing title and source', async () => {
      const result = await service.enrich(makeInput());
      expect(result.summary).toContain('Chamamento Público — Cultura Digital 2025');
      expect(result.summary).toContain('Transferegov');
    });

    it('returns a non-empty eligibleOrgProfile', async () => {
      const result = await service.enrich(makeInput());
      expect(result.eligibleOrgProfile).toBeTruthy();
      expect(result.eligibleOrgProfile.length).toBeGreaterThan(10);
    });

    it('returns between 3 and 5 firstSteps', async () => {
      const result = await service.enrich(makeInput());
      expect(result.firstSteps.length).toBeGreaterThanOrEqual(3);
      expect(result.firstSteps.length).toBeLessThanOrEqual(5);
    });

    it('does not throw even with empty areas', async () => {
      const result = await service.enrich(makeInput({ areas: [] }));
      expect(result.summary).toBeTruthy();
    });
  });

  describe('with API key (real client mocked)', () => {
    let service: EnrichmentService;

    beforeEach(() => {
      service = new EnrichmentService('fake-key-for-tests');
    });

    it('parses valid JSON response from Claude', async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce(
        apiResponse({
          summary: 'Este edital apoia projetos de cultura digital.',
          eligibleOrgProfile: 'ONGs com projetos de inclusão digital.',
          firstSteps: ['Ler edital', 'Verificar CNPJ ativo', 'Preparar projeto'],
        }),
      );

      const result = await service.enrich(makeInput());
      expect(result.summary).toBe('Este edital apoia projetos de cultura digital.');
      expect(result.eligibleOrgProfile).toBe('ONGs com projetos de inclusão digital.');
      expect(result.firstSteps).toEqual(['Ler edital', 'Verificar CNPJ ativo', 'Preparar projeto']);
    });

    it('falls back gracefully when Claude returns invalid JSON', async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'desculpe, não consigo ajudar com isso' } }],
      });

      const result = await service.enrich(makeInput());
      expect(result.summary).toContain('Transferegov'); // fallback summary
      expect(result.firstSteps.length).toBeGreaterThanOrEqual(3);
    });

    it('strips markdown fences from Claude response', async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content:
                '```json\n{"summary":"ok","eligibleOrgProfile":"ok","firstSteps":["a","b","c"]}\n```',
            },
          },
        ],
      });

      const result = await service.enrich(makeInput());
      expect(result.summary).toBe('ok');
      expect(result.firstSteps).toEqual(['a', 'b', 'c']);
    });

    it('uses fullText when provided, truncated to 3000 chars', async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce(
        apiResponse({ summary: 'com fullText', eligibleOrgProfile: 'ok', firstSteps: ['a'] }),
      );

      const longText = 'X'.repeat(5000);
      await service.enrich(makeInput({ fullText: longText }));

      const lastCall = mockCreate.mock.calls[mockCreate.mock.calls.length - 1];
      const callArgs = lastCall[0] as { messages: Array<{ content: string }> };
      const prompt = callArgs.messages[0].content;
      expect(prompt).toContain('Texto completo');
      // fullText truncated at 3000 chars
      expect((prompt.match(/X+/)?.[0] ?? '').length).toBeLessThanOrEqual(3000);
    });
  });

  describe('enrichOpportunity (cache behaviour)', () => {
    let service: EnrichmentService;

    beforeEach(() => {
      service = new EnrichmentService(undefined);
    });

    it('skips enrichment when aiSummary already exists', async () => {
      const prisma = {
        opportunity: {
          findUnique: vi.fn().mockResolvedValue({ aiSummary: 'already enriched' }),
          update: vi.fn(),
        },
      } as unknown as PrismaClient;

      await service.enrichOpportunity(prisma, 'opp-1', makeInput());

      expect(prisma.opportunity.update).not.toHaveBeenCalled();
    });

    it('enriches when aiSummary is null', async () => {
      const prisma = {
        opportunity: {
          findUnique: vi.fn().mockResolvedValue({ aiSummary: null }),
          update: vi.fn().mockResolvedValue({}),
        },
      } as unknown as PrismaClient;

      await service.enrichOpportunity(prisma, 'opp-1', makeInput());

      expect(prisma.opportunity.update).toHaveBeenCalledOnce();
      const updateArg = (prisma.opportunity.update as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as {
        where: { id: string };
        data: { aiSummary: string };
      };
      expect(updateArg.where.id).toBe('opp-1');
      expect(updateArg.data.aiSummary).toBeTruthy();
    });

    it('re-enriches when force=true regardless of existing summary', async () => {
      const prisma = {
        opportunity: {
          findUnique: vi.fn().mockResolvedValue({ aiSummary: 'old summary' }),
          update: vi.fn().mockResolvedValue({}),
        },
      } as unknown as PrismaClient;

      await service.enrichOpportunity(prisma, 'opp-1', makeInput(), true);

      expect(prisma.opportunity.update).toHaveBeenCalledOnce();
    });
  });
});
