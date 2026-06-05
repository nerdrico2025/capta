'use client';

const SOURCES = [
  'SALIC',
  'FINEP',
  'GIFE',
  'FAPESP',
  'FAPERJ',
  'FAPEMIG',
  'PROSAS',
  'OBSERVATORIO_3SETOR',
  'ESCOLA_ABERTA_3SETOR',
  'FUNDACAO_BB',
  'FUNDACAO_VALE',
  'FUNDACAO_LEMANN',
  'MINC',
] as const;

const SOURCE_LABELS: Record<string, string> = {
  SALIC: 'SALIC',
  FINEP: 'FINEP',
  GIFE: 'GIFE',
  FAPESP: 'FAPESP',
  FAPERJ: 'FAPERJ',
  FAPEMIG: 'FAPEMIG',
  PROSAS: 'Prosas',
  OBSERVATORIO_3SETOR: 'Obs. 3º Setor',
  ESCOLA_ABERTA_3SETOR: 'Escola Aberta',
  FUNDACAO_BB: 'Fund. BB',
  FUNDACAO_VALE: 'Fund. Vale',
  FUNDACAO_LEMANN: 'Fund. Lemann',
  MINC: 'MinC',
};

interface SourceFilterChipsProps {
  selected: string;
  onChange: (source: string) => void;
}

export function SourceFilterChips({ selected, onChange }: SourceFilterChipsProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="source-filter" className="shrink-0 text-sm font-medium text-gray-500">
        Fonte:
      </label>
      <select
        id="source-filter"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="focus:ring-primary rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1"
      >
        <option value="">Todas as fontes</option>
        {SOURCES.map((s) => (
          <option key={s} value={s}>
            {SOURCE_LABELS[s] ?? s}
          </option>
        ))}
      </select>
    </div>
  );
}
