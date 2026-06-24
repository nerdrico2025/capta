import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkOpportunityLinks } from '../validation.job.js';

type Update = { id: string; linkStatus?: string; linkCheckedAt?: Date };
type Alert = { opportunityId: string; type: string; message: string };

function makeFakePrisma(items: Array<{ id: string; sourceUrl: string }>) {
  const updates: Update[] = [];
  const alerts: Alert[] = [];
  const prisma = {
    opportunity: {
      findMany: vi.fn(async () => items),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { linkStatus?: string; linkCheckedAt?: Date };
        }) => {
          updates.push({ id: where.id, ...data });
          return {};
        },
      ),
    },
    dataAlert: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Alert }) => {
        alerts.push(data);
        return data;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { prisma, updates, alerts };
}

function fakeResponse(opts: {
  status: number;
  url: string;
  contentType: string | null;
  body?: string;
}) {
  return {
    status: opts.status,
    url: opts.url,
    headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? opts.contentType : null) },
    text: async () => opts.body ?? '',
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('checkOpportunityLinks', () => {
  it('classifica parede de login (200 + form de senha) como REQUIRES_AUTH', async () => {
    const { prisma, updates, alerts } = makeFakePrisma([
      { id: 'a', sourceUrl: 'https://x.org/restrito' },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        fakeResponse({
          status: 200,
          url: 'https://x.org/restrito',
          contentType: 'text/html',
          body: '<form action="/login"><input type="password" name="senha"></form>',
        }),
      ),
    );

    const r = await checkOpportunityLinks(prisma, new Date('2026-06-24T00:00:00Z'));

    expect(r.loginWallsFlagged).toBe(1);
    expect(updates[0].linkStatus).toBe('REQUIRES_AUTH');
    expect(updates[0].linkCheckedAt).toBeInstanceOf(Date);
    expect(alerts[0]).toMatchObject({ opportunityId: 'a', type: 'LINK_REQUIRES_AUTH' });
  });

  it('classifica 404 como BROKEN com alerta SCRAPE_FAILED', async () => {
    const { prisma, updates, alerts } = makeFakePrisma([
      { id: 'b', sourceUrl: 'https://x.org/sumiu' },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        fakeResponse({ status: 404, url: 'https://x.org/sumiu', contentType: 'text/html' }),
      ),
    );

    const r = await checkOpportunityLinks(prisma, new Date('2026-06-24T00:00:00Z'));

    expect(r.brokenFlagged).toBe(1);
    expect(updates[0].linkStatus).toBe('BROKEN');
    expect(updates[0].linkCheckedAt).toBeInstanceOf(Date);
    expect(alerts[0]).toMatchObject({ type: 'SCRAPE_FAILED' });
  });

  it('marca URL relativa legada como RELATIVE sem fazer fetch', async () => {
    const { prisma, updates, alerts } = makeFakePrisma([{ id: 'c', sourceUrl: '/relativo/123' }]);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await checkOpportunityLinks(prisma, new Date('2026-06-24T00:00:00Z'));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(r.relativeFlagged).toBe(1);
    expect(updates[0].linkStatus).toBe('RELATIVE');
    expect(alerts[0]).toMatchObject({ type: 'LINK_RELATIVE' });
  });

  it('200 de conteúdo normal → OK e linkCheckedAt atualizado', async () => {
    const { prisma, updates } = makeFakePrisma([{ id: 'd', sourceUrl: 'https://x.org/edital/1' }]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        fakeResponse({
          status: 200,
          url: 'https://x.org/edital/1',
          contentType: 'text/html',
          body: '<h1>Edital de Cultura 2026</h1>',
        }),
      ),
    );

    const r = await checkOpportunityLinks(prisma, new Date('2026-06-24T00:00:00Z'));

    expect(r.linksOk).toBe(1);
    expect(updates[0].linkStatus).toBe('OK');
    expect(updates[0].linkCheckedAt).toEqual(new Date('2026-06-24T00:00:00Z'));
  });
});
