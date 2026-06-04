'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Opportunity } from '@/types/api';
import { getDeadlineInfo, formatValue } from '@/lib/format';

const MINOR_WORDS = new Set([
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
    .map((word, i) =>
      i === 0 || !MINOR_WORDS.has(word) ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(' ');
}
import { SourceBadge } from '@/components/ui/SourceBadge';
import { cn } from '@/lib/cn';

interface OpportunityCardProps {
  opportunity: Opportunity;
}

function DeadlinePill({ deadline }: { deadline: string }) {
  const info = getDeadlineInfo(deadline);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        info.badgeClass,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', info.dotClass)} aria-hidden />
      {info.label}
    </span>
  );
}

function SaveButton({ id: _id }: { id: string }) {
  const [saved, setSaved] = useState(false);

  return (
    <button
      aria-label={saved ? 'Remover dos salvos' : 'Salvar oportunidade'}
      onClick={(e) => {
        e.preventDefault();
        setSaved((v) => !v);
      }}
      className={cn(
        'rounded-full p-1.5 transition-colors',
        saved ? 'text-red-500 hover:text-red-600' : 'text-gray-300 hover:text-red-400',
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}

export function OpportunityCard({ opportunity: opp }: OpportunityCardProps) {
  return (
    <article className="shadow-card hover:shadow-card-hover group flex flex-col rounded-2xl border border-gray-100 bg-white transition-all duration-200 hover:-translate-y-0.5">
      {/* Header row */}
      <div className="flex items-start justify-between p-5 pb-3">
        <SourceBadge source={opp.source} type={opp.type} />
        <SaveButton id={opp.id} />
      </div>

      {/* Title */}
      <div className="px-5 pb-3">
        <h3 className="font-display group-hover:text-primary line-clamp-2 text-base font-semibold leading-snug text-gray-900 transition-colors">
          {opp.title}
        </h3>
      </div>

      {/* Deadline + value */}
      <div className="flex items-center gap-3 px-5 pb-3">
        <DeadlinePill deadline={opp.deadline} />
        {opp.value != null && opp.value !== 0 && (
          <span className="text-primary text-sm font-bold">{formatValue(opp.value)}</span>
        )}
      </div>

      {/* Areas */}
      {opp.areas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-4">
          {opp.areas.slice(0, 3).map((area) => (
            <span
              key={area}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
            >
              {toTitleCase(area)}
            </span>
          ))}
          {opp.areas.length > 3 && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-400">
              +{opp.areas.length - 3}
            </span>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="mt-auto border-t border-gray-100 px-5 py-4">
        <Link
          href={`/opportunity/${opp.id}`}
          className="bg-primary-50 text-primary hover:bg-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors hover:text-white"
        >
          {opp.type === 'LEI'
            ? 'Ver projeto'
            : opp.type === 'PRIVADO'
              ? 'Ver oportunidade'
              : 'Ver edital'}
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path
              fillRule="evenodd"
              d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
      </div>
    </article>
  );
}
