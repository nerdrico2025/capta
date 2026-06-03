import { BaseScraper } from './base.scraper.js';
import type { MappedOpportunity } from '../collectors/types.js';

// Ministério do Esporte — DEPRECATED
// gov.br/esporte reorganized its URL structure. Chamamentos Públicos from this
// ministry are already collected via TransferegovCollector (situacao=ABERTO).
// This scraper is kept as a no-op to preserve the class interface.

export class MinisterioEsporteScraper extends BaseScraper {
  readonly source = 'Ministério do Esporte';

  async scrape(): Promise<unknown[]> {
    console.info('[MinisterioEsporte] Skipped — chamamentos covered by TransferegovCollector');
    return [];
  }

  mapItem(_raw: unknown): MappedOpportunity | null {
    return null;
  }
}
