import { describe, it, expect } from 'vitest';
import { isOfficialEditalUrl } from '../url-filter.js';

describe('isOfficialEditalUrl — allowlist por fonte + blocklist de imprensa', () => {
  it('aceita URL oficial no domínio da fonte', () => {
    expect(
      isOfficialEditalUrl('ABC Captadores', 'https://captadores.org.br/oportunidades/edital-x'),
    ).toBe(true);
    expect(isOfficialEditalUrl('GIFE', 'https://gife.org.br/premio-cultura-2026')).toBe(true);
  });

  it('bloqueia caminhos de imprensa/blog mesmo no domínio oficial', () => {
    expect(isOfficialEditalUrl('ABC Captadores', 'https://captadores.org.br/blog/dicas')).toBe(
      false,
    );
    expect(isOfficialEditalUrl('GIFE', 'https://gife.org.br/noticias/algo')).toBe(false);
  });

  it('bloqueia URLs fora do domínio oficial da fonte (link p/ imprensa)', () => {
    expect(isOfficialEditalUrl('GIFE', 'https://g1.globo.com/cultura/edital')).toBe(false);
    expect(isOfficialEditalUrl('ABC Captadores', 'https://outro.com/editais/x')).toBe(false);
  });

  it('sem allowlist de domínio: exige cara de seção de edital', () => {
    expect(isOfficialEditalUrl('Fonte X', 'https://fund.org/editais/edital-2026')).toBe(true);
    expect(isOfficialEditalUrl('Fonte X', 'https://fund.org/sobre-nos')).toBe(false);
    expect(isOfficialEditalUrl('Fonte X', 'https://fund.org/noticias/edital')).toBe(false);
  });

  it('rejeita URLs não-absolutas', () => {
    expect(isOfficialEditalUrl('Fonte X', '/editais/relativo')).toBe(false);
  });
});
