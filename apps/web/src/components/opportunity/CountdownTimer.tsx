'use client';

import { useEffect, useState } from 'react';
import { getTimeLeft } from '@/lib/format';

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-primary-50 text-primary font-display flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-bold tabular-nums">
        {String(value).padStart(2, '0')}
      </div>
      <span className="mt-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
    </div>
  );
}

interface CountdownTimerProps {
  deadline: string;
}

export function CountdownTimer({ deadline }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(deadline));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0) {
    return (
      <div className="rounded-xl bg-gray-100 p-4 text-center text-sm font-medium text-gray-500">
        Prazo encerrado
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-gray-600">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-500" aria-hidden>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
            clipRule="evenodd"
          />
        </svg>
        Prazo se encerra em
      </p>
      <div className="flex items-start gap-3">
        <TimeUnit value={timeLeft.days} label="dias" />
        <span className="mt-3.5 text-xl font-bold text-gray-300">:</span>
        <TimeUnit value={timeLeft.hours} label="horas" />
        <span className="mt-3.5 text-xl font-bold text-gray-300">:</span>
        <TimeUnit value={timeLeft.minutes} label="min" />
      </div>
    </div>
  );
}
