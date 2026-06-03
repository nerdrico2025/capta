'use client';

import { useState } from 'react';
import { CnpjInput } from './CnpjInput';
import { OscPreview } from './OscPreview';
import { useOscProfile } from '@/hooks/useOscProfile';
import type { OscProfile } from '@/types/api';

interface Step1Props {
  initialCnpj?: string;
  onNext: (cnpj: string, osc: OscProfile | null, name: string) => void;
}

export function Step1({ initialCnpj = '', onNext }: Step1Props) {
  const [cnpjRaw, setCnpjRaw] = useState(initialCnpj);
  const [manualName, setManualName] = useState('');
  const [showManual, setShowManual] = useState(false);

  const { data: osc, isLoading, isError } = useOscProfile(cnpjRaw);

  const isComplete = cnpjRaw.length === 14;
  const notFound = isError && isComplete;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete) return;

    const name = osc?.name ?? manualName.trim();
    if (!name) return;
    onNext(cnpjRaw, osc ?? null, name);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">
          CNPJ da organização
        </label>
        <CnpjInput
          value={cnpjRaw}
          onChange={(raw) => {
            setCnpjRaw(raw);
            setShowManual(false);
          }}
        />
      </div>

      {isLoading && isComplete && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Buscando organização...
        </div>
      )}

      {osc && <OscPreview osc={osc} />}

      {notFound && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            Não encontramos sua organização no Mapa das OSCs.
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Você pode continuar informando o nome manualmente.
          </p>
          {!showManual && (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="mt-2 text-sm font-semibold text-amber-800 underline"
            >
              Informar nome manualmente
            </button>
          )}
        </div>
      )}

      {showManual && notFound && (
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Nome da organização
          </label>
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Ex: Associação Cultural Exemplo"
            className="focus:border-primary focus:ring-primary/20 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={!isComplete || isLoading || (notFound && !manualName.trim())}
        className="bg-primary hover:bg-primary-dark w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continuar
      </button>
    </form>
  );
}
