'use client';

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
      <label htmlFor="area-filter" className="shrink-0 text-sm font-medium text-gray-500">
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
          <option key={area} value={area} className="capitalize">
            {area.charAt(0).toUpperCase() + area.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
