'use client';

import { useEffect, useState } from 'react';
import { useOrg } from '@/context/OrgContext';
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push';

type PushState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

export function PushToggle() {
  const { cnpj, isOnboarded } = useOrg();
  const [state, setState] = useState<PushState>('loading');
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOnboarded) return;

    async function init() {
      if (!isPushSupported()) {
        setState('unsupported');
        return;
      }

      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }

      const existing = await getExistingSubscription();
      setState(existing ? 'subscribed' : 'unsubscribed');
    }

    void init();
  }, [isOnboarded]);

  async function handleToggle() {
    setToggling(true);
    setError('');

    try {
      if (state === 'subscribed') {
        await unsubscribeFromPush(cnpj);
        setState('unsubscribed');
      } else {
        await subscribeToPush(cnpj);
        setState('subscribed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao configurar notificações';
      if (msg.includes('denied')) {
        setState('denied');
      } else {
        setError(msg);
      }
    } finally {
      setToggling(false);
    }
  }

  if (!isOnboarded || state === 'loading' || state === 'unsupported') return null;

  if (state === 'denied') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <svg
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <div>
          <p className="text-xs font-semibold text-amber-800">Notificações bloqueadas</p>
          <p className="mt-0.5 text-xs text-amber-700">
            Permita notificações nas configurações do navegador para receber alertas de prazo.
          </p>
        </div>
      </div>
    );
  }

  const isSubscribed = state === 'subscribed';

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div
          className={[
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors',
            isSubscribed ? 'bg-accent/15' : 'bg-gray-100',
          ].join(' ')}
        >
          <svg
            className={[
              'h-4.5 w-4.5 transition-colors',
              isSubscribed ? 'text-accent-dark' : 'text-gray-400',
            ].join(' ')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Notificações push</p>
          <p className="text-xs text-gray-500">
            {isSubscribed
              ? 'Você receberá alertas de prazo no navegador'
              : 'Receba alertas de prazo direto no navegador'}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={toggling}
        aria-pressed={isSubscribed}
        className={[
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
          'focus:ring-primary focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          isSubscribed ? 'bg-accent' : 'bg-gray-200',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
            isSubscribed ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>

      {error && <p className="absolute mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
