'use client';

import { cn } from '@/lib/cn';

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
  selected: string[];
  onChange: (areas: string[]) => void;
}

export function AreaFilterChips({ selected, onChange }: AreaFilterChipsProps) {
  function toggle(area: string) {
    if (selected.includes(area)) {
      onChange(selected.filter((a) => a !== area));
    } else {
      onChange([...selected, area]);
    }
  }

  return (
    <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-sm font-medium text-gray-500">Área:</span>
      <div className="flex gap-2">
        {AREAS.map((area) => {
          const active = selected.includes(area);
          return (
            <button
              key={area}
              type="button"
              onClick={() => toggle(area)}
              aria-pressed={active}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all',
                active
                  ? 'bg-primary text-white shadow-sm'
                  : 'hover:border-primary hover:text-primary border border-gray-200 bg-white text-gray-600',
              )}
            >
              {area}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="shrink-0 text-xs text-gray-400 underline transition-colors hover:text-gray-600"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
