/**
 * url-filter.ts — endurecimento dos scrapers: allowlist por fonte (só seções
 * oficiais de editais, no domínio do financiador) + blocklist de imprensa/blog.
 * Compartilha o vocabulário de URL com o classificador (lib/url-patterns).
 */
import { isPressUrl, isEditalUrl } from '../../lib/url-patterns.js';

// Domínio oficial do financiador por fonte (allowlist de host).
const SOURCE_DOMAIN: Record<string, RegExp> = {
  'ABC Captadores': /(^|\.)captadores\.org\.br$/i,
  GIFE: /(^|\.)gife\.org\.br$/i,
};

/**
 * Aceita a URL apenas se:
 *  - for http(s) absoluta;
 *  - NÃO for caminho de imprensa/blog/release (blocklist);
 *  - e, havendo allowlist de domínio para a fonte, estiver nesse domínio
 *    (bloqueia links que saem para veículos de imprensa). Sem allowlist,
 *    exige cara de seção de edital.
 */
export function isOfficialEditalUrl(source: string, url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (isPressUrl(url)) return false;

  const domainRe = SOURCE_DOMAIN[source];
  if (domainRe) {
    try {
      return domainRe.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }
  return isEditalUrl(url);
}
