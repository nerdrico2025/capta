import { describe, it, expect, vi } from 'vitest';
import { upsertOpportunity } from '../base.collector.js';
import type { MappedOpportunity } from '../types.js';

function mapped(overrides: Partial<MappedOpportunity> = {}): MappedOpportunity {
  return {
    title: 'Edital X',
    source: 'TEST',
    type: 'EDITAL',
    sourceType: 'scraper',
    sourceUrl: 'https://x.org/e/1',
    portalUrl: 'https://x.org/editais/',
    deadline: new Date('2026-12-01T00:00:00Z'),
    value: 0,
    areas: [],
    summary: 'resumo',
    isActive: true,
    ...overrides,
  };
}

function fakePrisma() {
  const upsert = vi.fn(async (_args: unknown) => ({ id: '1', aiSummary: null }));
  const findUnique = vi.fn(async () => null); // sem classificação prévia
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { prisma: { opportunity: { upsert, findUnique } } as any, upsert };
}

describe('upsertOpportunity — guarda de URL na ingestão', () => {
  it('rejeita sourceUrl vazia (não persiste)', async () => {
    const { prisma, upsert } = fakePrisma();
    await expect(upsertOpportunity(prisma, mapped({ sourceUrl: '   ' }))).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejeita sourceUrl relativa sem base resolvível (não persiste)', async () => {
    const { prisma, upsert } = fakePrisma();
    await expect(
      upsertOpportunity(prisma, mapped({ sourceUrl: '/rel/1', portalUrl: 'not-a-url' })),
    ).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('resolve sourceUrl relativa contra a base (portalUrl) e persiste a absoluta', async () => {
    const { prisma, upsert } = fakePrisma();
    await upsertOpportunity(
      prisma,
      mapped({ sourceUrl: '/editais/123', portalUrl: 'https://x.org/editais/' }),
    );
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0] as {
      where: { sourceUrl: string };
      create: { sourceUrl: string };
    };
    expect(arg.where.sourceUrl).toBe('https://x.org/editais/123');
    expect(arg.create.sourceUrl).toBe('https://x.org/editais/123');
  });
});
