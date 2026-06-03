import { BaseScraper } from './base.scraper.js';
import type { MappedOpportunity } from '../collectors/types.js';

// Ministério do Idoso — DEPRECATED
// gov.br/mdh chamamentos endpoint requires authentication. Chamamentos from this
// ministry are already collected via TransferegovCollector (situacao=ABERTO).
// This scraper is kept as a no-op to preserve the class interface.

export class MinisterioIdosoScraper extends BaseScraper {
  readonly source = 'Ministério do Idoso';

  async scrape(): Promise<unknown[]> {
    console.info('[MinisterioIdoso] Skipped — chamamentos covered by TransferegovCollector');
    return [];
  }

  mapItem(_raw: unknown): MappedOpportunity | null {
    return null;
  }
}
