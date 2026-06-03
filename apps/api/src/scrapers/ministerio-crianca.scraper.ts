import { BaseScraper } from './base.scraper.js';
import type { MappedOpportunity } from '../collectors/types.js';

// Ministério da Criança — DEPRECATED
// gov.br/mds chamamentos endpoint returns 404. Chamamentos from this ministry
// are already collected via TransferegovCollector (situacao=ABERTO).
// This scraper is kept as a no-op to preserve the class interface.

export class MinisterioCriancaScraper extends BaseScraper {
  readonly source = 'Ministério da Criança';

  async scrape(): Promise<unknown[]> {
    console.info('[MinisterioCrianca] Skipped — chamamentos covered by TransferegovCollector');
    return [];
  }

  mapItem(_raw: unknown): MappedOpportunity | null {
    return null;
  }
}
