/**
 * url-patterns.ts — vocabulário de URL compartilhado pelo classificador
 * (services/classification.service.ts) e pela allowlist dos scrapers
 * (scrapers/utils/url-filter.ts). Fonte única para não divergirem.
 */

// Seções oficiais de editais/chamamentos.
export const EDITAL_URL_RE =
  /\/(editais?|chamamentos?|chamadas?|sele[çc][aã]o|selecao)(?=[/?#-]|$)/i;

// Caminhos de imprensa/blog/release (conteúdo SOBRE editais, não o edital).
export const PRESS_URL_RE =
  /\/(not[ií]cias?|imprensa|blog|sala-de-imprensa|releases?|news|press)(?=[/?#-]|$)/i;

// Domínios de veículos de imprensa (não-financiadores).
const PRESS_DOMAIN_RE =
  /(^|\.)(g1\.globo|globo|uol|folha|estadao|metropoles|terra|r7|cartacapital|agenciabrasil|ig\.com|veja\.abril)\./i;

export function isEditalUrl(url: string): boolean {
  return EDITAL_URL_RE.test(url);
}

export function isPressUrl(url: string): boolean {
  return PRESS_URL_RE.test(url);
}

export function isPressDomain(url: string): boolean {
  try {
    return PRESS_DOMAIN_RE.test(new URL(url).hostname);
  } catch {
    return PRESS_DOMAIN_RE.test(url);
  }
}
