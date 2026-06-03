'use client';

import { useState } from 'react';

const DAY_OPTIONS = [
  { value: 15, label: '15 dias', description: 'Alerta antecipado' },
  { value: 7, label: '7 dias', description: 'Uma semana antes' },
  { value: 1, label: '1 dia', description: 'Último dia útil' },
] as const;

interface Step3Props {
  orgName: string;
  onComplete: (email: string, days: (1 | 7 | 15)[]) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function Step3({ orgName, onComplete, onBack, isLoading = false }: Step3Props) {
  const [email, setEmail] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [days, setDays] = useState<Set<1 | 7 | 15>>(new Set([15, 7, 1]));

  function toggleDay(day: 1 | 7 | 15) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailEnabled && (!email || days.size === 0)) return;
    onComplete(emailEnabled ? email : '', [...days] as (1 | 7 | 15)[]);
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">Configurando alertas para</p>
        <p className="font-semibold text-gray-900">{orgName}</p>
      </div>

      {/* Email toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">Receber alertas por e-mail</p>
          <p className="text-xs text-gray-500">
            Notificações automáticas quando editais estiverem próximos do prazo
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={emailEnabled}
          onClick={() => setEmailEnabled((v) => !v)}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
            emailEnabled ? 'bg-primary' : 'bg-gray-200',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
              emailEnabled ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>

      {emailEnabled && (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              E-mail para alertas
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@suaorg.org.br"
              className="focus:border-primary focus:ring-primary/20 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-700">Quando receber o alerta?</p>
            <div className="space-y-2">
              {DAY_OPTIONS.map(({ value, label, description }) => {
                const isSelected = days.has(value);
                return (
                  <label
                    key={value}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDay(value)}
                      className="sr-only"
                    />
                    <div
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                        isSelected ? 'border-primary bg-primary' : 'border-gray-300',
                      ].join(' ')}
                    >
                      {isSelected && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{label}</span>
                      <span className="ml-2 text-xs text-gray-500">{description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </>
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
          disabled={isLoading || (emailEnabled && (!emailValid || days.size === 0))}
          className="bg-accent hover:bg-accent-dark flex-[2] rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? 'Salvando...' : 'Concluir e ver editais'}
        </button>
      </div>
    </form>
  );
}
