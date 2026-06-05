'use client';

import { cn } from '@/lib/cn';
import type { OpportunityFilterType } from '@/types/api';

interface Tab {
  value: OpportunityFilterType;
  label: string;
  color?: string;
}

const TABS: Tab[] = [
  { value: '', label: 'Todos' },
  { value: 'edital', label: 'Editais', color: 'text-primary' },
  { value: 'lei', label: 'Incentivo', color: 'text-purple-600' },
  { value: 'privado', label: 'Privado', color: 'text-accent-dark' },
];

interface TypeFilterTabsProps {
  selected: OpportunityFilterType;
  onChange: (type: OpportunityFilterType) => void;
}

export function TypeFilterTabs({ selected, onChange }: TypeFilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Tipo de recurso"
      className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1"
    >
      {TABS.map((tab) => {
        const active = tab.value === selected;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-all',
              active
                ? 'bg-primary text-white shadow-sm'
                : cn('text-gray-600 hover:text-gray-900', tab.color && !active && tab.color),
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
