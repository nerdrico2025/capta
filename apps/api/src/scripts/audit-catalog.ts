/**
 * audit-catalog.ts — Auditoria SOMENTE LEITURA do catálogo de oportunidades.
 *
 * Não escreve no banco. Classifica cada Opportunity em um rótulo ÚNICO segundo a
 * precedência abaixo e imprime contagens, matriz de sobreposição e exemplos.
 *
 *   Precedência: SALIC_CAPTACAO > VENCIDO_ATIVO > JA_DESATIVADO
 *                > LINK_SUSPEITO > POSSIVEL_MATERIA > OK
 *
 * Rodar (de apps/api/): DATABASE_URL=... npx tsx src/scripts/audit-catalog.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const NOW = new Date();

// ─── Heurísticas ────────────────────────────────────────────────────────────

// LINK_SUSPEITO é puramente ESTRUTURAL (sem request de rede): URL vazia, relativa
// ou com cara de login. Subestima links quebrados (um 404 com URL bem-formada
// passa como OK). A checagem de rede real fica para uma etapa posterior.
const LOGIN_PATTERNS = ['/login', '/signin', '/entrar', '/acesso', 'wp-login', '?login', '/auth'];
const NEWS_PATTERNS = [
  '/noticias/',
  '/noticia/',
  '/imprensa/',
  '/blog/',
  '/sala-de-imprensa/',
  '/releases/',
  '/news/',
];

function isBlankOrRelative(url: string | null | undefined): boolean {
  if (!url || url.trim() === '') return true;
  return !/^https?:\/\//i.test(url.trim());
}

function looksLikeLogin(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return LOGIN_PATTERNS.some((p) => u.includes(p));
}

function looksLikeNews(...urls: Array<string | null | undefined>): boolean {
  return urls.some((url) => {
    if (!url) return false;
    const u = url.toLowerCase();
    return NEWS_PATTERNS.some((p) => u.includes(p));
  });
}

type Flags = {
  isSalic: boolean;
  isVencidoAtivo: boolean;
  isJaDesativado: boolean;
  isLinkSuspeito: boolean;
  isPossivelMateria: boolean;
};

type Label =
  | 'SALIC_CAPTACAO'
  | 'VENCIDO_ATIVO'
  | 'JA_DESATIVADO'
  | 'LINK_SUSPEITO'
  | 'POSSIVEL_MATERIA'
  | 'OK';

const FLAG_KEYS: Array<keyof Flags> = [
  'isSalic',
  'isVencidoAtivo',
  'isJaDesativado',
  'isLinkSuspeito',
  'isPossivelMateria',
];

interface OppRow {
  id: string;
  title: string;
  source: string;
  type: string;
  deadline: Date;
  isActive: boolean;
  sourceUrl: string;
  portalUrl: string;
  pdfUrl: string | null;
}

function computeFlags(o: OppRow): Flags {
  return {
    isSalic: o.source === 'SALIC',
    isVencidoAtivo: o.isActive === true && o.deadline < NOW,
    isJaDesativado: o.isActive === false,
    isLinkSuspeito:
      isBlankOrRelative(o.sourceUrl) ||
      isBlankOrRelative(o.portalUrl) ||
      looksLikeLogin(o.sourceUrl) ||
      looksLikeLogin(o.portalUrl),
    isPossivelMateria: looksLikeNews(o.sourceUrl, o.portalUrl, o.pdfUrl),
  };
}

// Rótulo único por precedência.
function labelOf(f: Flags): Label {
  if (f.isSalic) return 'SALIC_CAPTACAO';
  if (f.isVencidoAtivo) return 'VENCIDO_ATIVO';
  if (f.isJaDesativado) return 'JA_DESATIVADO';
  if (f.isLinkSuspeito) return 'LINK_SUSPEITO';
  if (f.isPossivelMateria) return 'POSSIVEL_MATERIA';
  return 'OK';
}

// ─── Relatório por visão ──────────────────────────────────────────────────────

const PROBLEM_LABELS: Label[] = [
  'SALIC_CAPTACAO',
  'VENCIDO_ATIVO',
  'JA_DESATIVADO',
  'LINK_SUSPEITO',
  'POSSIVEL_MATERIA',
];

function report(viewName: string, rows: OppRow[]): void {
  console.log('\n' + '='.repeat(72));
  console.log(`VISÃO: ${viewName}  —  total de registros: ${rows.length}`);
  console.log('='.repeat(72));

  const labeled = rows.map((o) => {
    const flags = computeFlags(o);
    return { row: o, flags, label: labelOf(flags) };
  });

  // Contagens por rótulo único.
  const counts: Record<Label, number> = {
    SALIC_CAPTACAO: 0,
    VENCIDO_ATIVO: 0,
    JA_DESATIVADO: 0,
    LINK_SUSPEITO: 0,
    POSSIVEL_MATERIA: 0,
    OK: 0,
  };
  for (const l of labeled) counts[l.label]++;

  console.log('\n— Contagem por categoria (rótulo único, por precedência) —');
  const order: Label[] = [...PROBLEM_LABELS, 'OK'];
  for (const lab of order) {
    const n = counts[lab];
    const pct = rows.length ? ((n / rows.length) * 100).toFixed(1) : '0.0';
    console.log(`  ${lab.padEnd(18)} ${String(n).padStart(6)}  (${pct}%)`);
  }

  // Matriz de sobreposição: co-ocorrência de flags (independe da precedência).
  console.log('\n— Matriz de sobreposição (flags brutas, sem precedência) —');
  console.log('  Linha = flag A; coluna = quantos desses TAMBÉM têm a flag B.');
  const header = '  ' + ''.padEnd(18) + FLAG_KEYS.map((k) => shortFlag(k).padStart(10)).join('');
  console.log(header);
  for (const a of FLAG_KEYS) {
    const cells = FLAG_KEYS.map((b) => {
      const n = labeled.filter((l) => l.flags[a] && l.flags[b]).length;
      return String(n).padStart(10);
    });
    console.log('  ' + shortFlag(a).padEnd(18) + cells.join(''));
  }

  // Exemplos: 10 por categoria-problema (pelo rótulo único).
  for (const lab of PROBLEM_LABELS) {
    const examples = labeled.filter((l) => l.label === lab).slice(0, 10);
    if (examples.length === 0) continue;
    console.log(`\n— Exemplos (${lab}) — mostrando ${examples.length} —`);
    for (const { row } of examples) {
      console.log(
        `  • [${row.source}] ${truncate(row.title, 60)}\n` +
          `    id=${row.id} active=${row.isActive} deadline=${row.deadline.toISOString().slice(0, 10)}\n` +
          `    url=${row.sourceUrl}`,
      );
    }
  }
}

function shortFlag(k: keyof Flags): string {
  return {
    isSalic: 'SALIC',
    isVencidoAtivo: 'VENC_ATIVO',
    isJaDesativado: 'DESATIVADO',
    isLinkSuspeito: 'LINK_SUSP',
    isPossivelMateria: 'MATERIA',
  }[k];
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const rows: OppRow[] = await prisma.opportunity.findMany({
  select: {
    id: true,
    title: true,
    source: true,
    type: true,
    deadline: true,
    isActive: true,
    sourceUrl: true,
    portalUrl: true,
    pdfUrl: true,
  },
});

console.log('AUDITORIA DO CATÁLOGO — somente leitura, nenhuma escrita no banco.');
console.log(`Executado em: ${NOW.toISOString()}`);
console.log(
  '\nNOTA — LINK_SUSPEITO é heurística ESTRUTURAL (URL vazia/relativa/cara de\n' +
    'login), SEM request de rede. Logo SUBESTIMA links quebrados: um 404 com\n' +
    'URL bem-formada passa como OK aqui. Checagem de rede real vem depois.',
);

report('(a) CATÁLOGO INTEIRO', rows);
report(
  "(b) SEM SALIC (baseline do trabalho que sobra após excluir source='SALIC')",
  rows.filter((r) => r.source !== 'SALIC'),
);

await prisma.$disconnect();
