'use client';

const MINOR = new Set([
  'e',
  'de',
  'a',
  'o',
  'do',
  'da',
  'dos',
  'das',
  'em',
  'no',
  'na',
  'por',
  'com',
  'para',
  'ao',
  'às',
]);
function toTitleCase(str: string): string {
  return str
    .split(' ')
    .map((w, i) => (i === 0 || !MINOR.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const AREAS = [
  'cultura',
  'educação',
  'saúde',
  'meio ambiente',
  'assistência social',
  'esporte',
  'ciência e tecnologia',
  'direitos humanos',
  'habitação',
  'segurança alimentar',
  'desenvolvimento rural',
];

interface AreaFilterChipsProps {
  selected: string;
  onChange: (area: string) => void;
}

export function AreaFilterChips({ selected, onChange }: AreaFilterChipsProps) {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="area-filter"
        className="hidden shrink-0 text-sm font-medium text-gray-500 md:inline"
      >
        Área:
      </label>
      <select
        id="area-filter"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="focus:ring-primary rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1"
      >
        <option value="">Todas as áreas</option>
        {AREAS.map((area) => (
          <option key={area} value={area}>
            {toTitleCase(area)}
          </option>
        ))}
      </select>
    </div>
  );
}
