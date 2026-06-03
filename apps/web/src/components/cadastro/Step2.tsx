'use client';

import { useState } from 'react';
import { AREAS } from '@/lib/areas';

interface Step2Props {
  initialAreas?: string[];
  onNext: (areas: string[]) => void;
  onBack: () => void;
}

export function Step2({ initialAreas = [], onNext, onBack }: Step2Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialAreas));

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) return;
    onNext([...selected]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-gray-500">
        Selecione as áreas de atuação da sua organização. Você receberá alertas apenas de
        oportunidades nessas áreas.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {AREAS.map((area) => {
          const isSelected = selected.has(area.value);
          return (
            <button
              key={area.value}
              type="button"
              onClick={() => toggle(area.value)}
              className={[
                'flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-medium transition-colors',
                isSelected
                  ? 'border-primary bg-primary text-white'
                  : 'hover:border-primary/40 hover:bg-primary/5 border-gray-200 bg-white text-gray-700',
              ].join(' ')}
            >
              <span className="text-base leading-none">{area.emoji}</span>
              <span>{area.label}</span>
            </button>
          );
        })}
      </div>

      {selected.size === 0 && (
        <p className="text-xs text-red-500">Selecione pelo menos uma área para continuar.</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={selected.size === 0}
          className="bg-primary hover:bg-primary-dark flex-[2] rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continuar
        </button>
      </div>
    </form>
  );
}
