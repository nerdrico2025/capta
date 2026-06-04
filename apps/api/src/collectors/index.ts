import type { PrismaClient } from '@prisma/client';
// TransferegovCollector desativado: API pública não existe (Portal da Transparência
// não expõe chamamentos; transferegov.sistema.gov.br e siconv.centralit.com.br estão fora do ar)
import { SalicCollector } from './salic.collector.js';
import { FinepCollector } from './finep.collector.js';
import { GifeCollector } from './gife.collector.js';
import { ItauSocialCollector } from './itau-social.collector.js';
import { FundacaoValeCollector } from './fundacao-vale.collector.js';
import { FundacaoLemannCollector } from './fundacao-lemann.collector.js';

import { ElasCollector } from './elas.collector.js';
import { FundacaoBBCollector } from './fundacao-bb.collector.js';
import { MapaOscCollector } from './mapa-osc.collector.js';
import { FapespCollector } from './fapesp.collector.js';
import { FaperjCollector } from './faperj.collector.js';
import { FapemigCollector } from './fapemig.collector.js';
import type { CollectorResult } from './types.js';

export { SalicCollector } from './salic.collector.js';
export { FinepCollector } from './finep.collector.js';
export { GifeCollector } from './gife.collector.js';
export { ItauSocialCollector } from './itau-social.collector.js';
export { FundacaoValeCollector } from './fundacao-vale.collector.js';
export { FundacaoLemannCollector } from './fundacao-lemann.collector.js';
export { NaturaCollector } from './natura.collector.js';
export { ElasCollector } from './elas.collector.js';
export { FundacaoBBCollector } from './fundacao-bb.collector.js';
export { MapaOscCollector } from './mapa-osc.collector.js';
export { FapespCollector } from './fapesp.collector.js';
export { FaperjCollector } from './faperj.collector.js';
export { FapemigCollector } from './fapemig.collector.js';
export type { CollectorResult } from './types.js';

export async function runAllCollectors(prisma: PrismaClient): Promise<CollectorResult[]> {
  const standardCollectors = [new SalicCollector(), new FinepCollector()];
  const allCollectors = [
    ...standardCollectors,
    new GifeCollector(),
    new ItauSocialCollector(),
    new FundacaoValeCollector(),
    new FundacaoLemannCollector(),
    // NaturaCollector desativado: Instituto Natura não publica editais abertos para OSCs externas
    new ElasCollector(),
    new FundacaoBBCollector(),
    new MapaOscCollector(),
    new FapespCollector(),
    new FaperjCollector(),
    new FapemigCollector(),
  ];

  const settled = await Promise.allSettled(allCollectors.map((c) => c.run({ prisma })));

  return settled.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;

    const source = allCollectors[i].source;
    const error = result.reason instanceof Error ? result.reason.message : String(result.reason);

    console.error(`[collector:${source}] Unhandled error:`, result.reason);

    return { source, itemsFound: 0, itemsUpserted: 0, error };
  });
}
