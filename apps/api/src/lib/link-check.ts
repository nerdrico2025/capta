/**
 * link-check.ts — utilidades puras de saúde de link (sem rede, testáveis).
 *
 *  - resolveSourceUrl: normaliza/resolve sourceUrl na ingestão (relativo→absoluto).
 *  - classifyResponse / isLoginWall: classifica uma resposta HTTP, detectando
 *    paredes de login (200 que na verdade é página de autenticação).
 */

export type LinkStatus = 'OK' | 'REQUIRES_AUTH' | 'BROKEN' | 'RELATIVE' | 'UNREACHABLE';

/**
 * Resolve a sourceUrl para uma URL absoluta http(s).
 *  - vazia ⇒ null (rejeitar)
 *  - já http(s) ⇒ retorna como está (trim)
 *  - relativa ⇒ resolve contra `base` (ex.: portalUrl); se não der http ⇒ null
 */
export function resolveSourceUrl(
  raw: string | null | undefined,
  base?: string | null,
): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (base) {
    try {
      const abs = new URL(s, base).toString();
      if (/^https?:\/\//i.test(abs)) return abs;
    } catch {
      /* base inválida — cai para null */
    }
  }
  return null;
}

// URL final (após redirects) que aponta para autenticação.
const LOGIN_URL_RE = /\/(login|signin|sign-in|entrar|acesso|auth|conta\/entrar)(?:[/?#]|$)/i;
// Sinais fortes no corpo HTML.
const PASSWORD_INPUT_RE = /<input[^>]+type\s*=\s*["']?password["']?/i;
const LOGIN_FORM_RE =
  /<form[^>]+action\s*=\s*["'][^"']*(?:login|signin|sign-in|entrar|acesso|auth)/i;

/**
 * Detecta parede de login após um 2xx: precisa ser HTML e ter sinal de
 * autenticação (campo de senha, form de login, ou URL final de login).
 */
export function isLoginWall(finalUrl: string, contentType: string | null, body: string): boolean {
  // Só inspeciona HTML — PDFs/JSON etc. não são paredes de login.
  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) return false;
  if (LOGIN_URL_RE.test(finalUrl)) return true;
  if (PASSWORD_INPUT_RE.test(body)) return true;
  if (LOGIN_FORM_RE.test(body)) return true;
  return false;
}

/** Classifica a resposta HTTP de um sourceUrl já absoluto. */
export function classifyResponse(
  status: number,
  finalUrl: string,
  contentType: string | null,
  body: string,
): LinkStatus {
  if (status === 405) return 'OK'; // método não permitido, mas servidor vivo
  if (status >= 200 && status < 300) {
    return isLoginWall(finalUrl, contentType, body) ? 'REQUIRES_AUTH' : 'OK';
  }
  if (status >= 400) return 'BROKEN';
  return 'OK';
}
