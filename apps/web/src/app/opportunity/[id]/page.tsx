'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { CountdownTimer } from '@/components/opportunity/CountdownTimer';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOpportunity } from '@/hooks/useOpportunity';
import { formatValue, formatDate, getDeadlineInfo } from '@/lib/format';
import { cn } from '@/lib/cn';

const PRIMEIROS_PASSOS = [
  {
    icon: '📄',
    title: 'Leia a documentação completa',
    description: 'Verifique todos os critérios de elegibilidade e requisitos do projeto.',
  },
  {
    icon: '📋',
    title: 'Reúna a documentação',
    description: 'Separe certidões, estatuto social, atas e demais documentos exigidos.',
  },
  {
    icon: '⚖️',
    title: 'Consulte sua assessoria jurídica',
    description: 'Confirme que a organização está apta a receber o tipo de recurso.',
  },
  {
    icon: '📝',
    title: 'Elabore o plano de trabalho',
    description: 'Descreva atividades, metas, cronograma e orçamento detalhados.',
  },
  {
    icon: '✅',
    title: 'Envie antes do prazo',
    description: 'Submeta a proposta com antecedência para evitar problemas técnicos.',
  },
];

function DetailSkeleton() {
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <div className="container-content py-8">
        <Skeleton className="mb-6 h-4 w-32" />
        <Skeleton className="mb-3 h-6 w-32 rounded-full" />
        <Skeleton className="mb-8 h-10 w-3/4" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OpportunityDetailPage({ params }: { params: { id: string } }) {
  const { data: opp, isLoading, isError } = useOpportunity(params.id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || !opp) notFound();

  const deadline = getDeadlineInfo(opp.deadline);

  return (
    <div className="bg-background min-h-screen">
      <Header />

      <div className="container-content py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-primary transition-colors">
            Oportunidades
          </Link>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 text-gray-300"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
          <span className="max-w-xs truncate text-gray-700">{opp.title}</span>
        </nav>

        {/* Title block */}
        <div className="mb-8">
          <SourceBadge source={opp.source} type={opp.type} className="mb-3" />
          <h1 className="font-display text-balance text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">
            {opp.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
            <span>Publicado em {formatDate(opp.createdAt)}</span>
            <span>·</span>
            <span>Atualizado em {formatDate(opp.updatedAt)}</span>
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* ── Main (2/3) ── */}
          <div className="space-y-6 lg:col-span-2">
            {/* Summary */}
            <section className="shadow-card rounded-2xl border border-gray-100 bg-white p-6">
              <h2 className="font-display mb-3 text-lg font-semibold text-gray-900">Resumo</h2>
              <p className="leading-relaxed text-gray-700">{opp.summary}</p>

              {/* Areas */}
              {opp.areas.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {opp.areas.map((area) => (
                    <span
                      key={area}
                      className="bg-primary-50 text-primary rounded-full px-3 py-1 text-xs font-medium capitalize"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Primeiros passos */}
            <section className="shadow-card rounded-2xl border border-gray-100 bg-white p-6">
              <h2 className="font-display mb-4 text-lg font-semibold text-gray-900">
                Primeiros passos
              </h2>
              <ol className="space-y-4">
                {PRIMEIROS_PASSOS.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="bg-primary-50 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg">
                      {step.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                      <p className="mt-0.5 text-sm text-gray-500">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* ── Sidebar (1/3) ── */}
          <aside className="space-y-4 lg:col-span-1">
            {/* Deadline card */}
            <div className="shadow-card rounded-2xl border border-gray-100 bg-white p-6">
              <CountdownTimer deadline={opp.deadline} />

              <div
                className={cn(
                  'mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
                  deadline.badgeClass,
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', deadline.dotClass)} aria-hidden />
                Encerra em {formatDate(opp.deadline)}
              </div>
            </div>

            {/* Value */}
            <div className="shadow-card rounded-2xl border border-gray-100 bg-white p-6">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                Valor estimado
              </p>
              <p className="font-display text-primary text-3xl font-bold">
                {formatValue(opp.value)}
              </p>
            </div>

            {/* CTAs */}
            <a
              href={opp.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary hover:bg-primary-dark flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                  clipRule="evenodd"
                />
                <path
                  fillRule="evenodd"
                  d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                  clipRule="evenodd"
                />
              </svg>
              Acessar portal
            </a>

            {opp.pdfUrl && (
              <a
                href={opp.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-primary text-primary hover:bg-primary-50 flex w-full items-center justify-center gap-2 rounded-xl border-2 px-6 py-3.5 text-sm font-semibold transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
                Baixar PDF
              </a>
            )}

            {/* Source info */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500">
              <p className="mb-1 font-medium text-gray-700">Fonte</p>
              <p>{opp.source}</p>
              <a
                href={opp.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-1 block truncate hover:underline"
              >
                {opp.sourceUrl}
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
