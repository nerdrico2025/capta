'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { SearchBar } from '@/components/search/SearchBar';
import { AreaFilterChips } from '@/components/search/AreaFilterChips';
import { TypeFilterTabs } from '@/components/search/TypeFilterTabs';
import { SourceFilterChips } from '@/components/search/SourceFilterChips';
import { OpportunityCard } from '@/components/opportunity/OpportunityCard';
import { OpportunityGridSkeleton } from '@/components/opportunity/OpportunityCardSkeleton';
import { useOpportunities } from '@/hooks/useOpportunities';
import type { DeadlineSort, OpportunityFilterType } from '@/types/api';
import { cn } from '@/lib/cn';

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-8 w-8 text-gray-400"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>
      <h3 className="font-display text-lg font-semibold text-gray-700">
        {hasFilters ? 'Nenhuma oportunidade encontrada' : 'Nenhuma oportunidade disponível'}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        {hasFilters
          ? 'Tente ajustar os filtros ou ampliar sua busca.'
          : 'Volte em breve — novos editais são adicionados diariamente.'}
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-8 w-8 text-red-400"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h3 className="font-display text-lg font-semibold text-gray-700">Erro ao carregar</h3>
      <p className="mt-1 text-sm text-gray-500">Não foi possível buscar as oportunidades.</p>
      <button
        onClick={onRetry}
        className="bg-primary hover:bg-primary-dark mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );
}

export function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [area, setArea] = useState(searchParams.get('area') ?? '');
  const [type, setType] = useState<OpportunityFilterType>(
    (searchParams.get('type') as OpportunityFilterType) ?? '',
  );
  const [sort, setSort] = useState<DeadlineSort>(
    (searchParams.get('deadline') as DeadlineSort) ?? 'asc',
  );
  const [source, setSource] = useState(searchParams.get('source') ?? '');
  const [excludeSalic, setExcludeSalic] = useState(searchParams.get('exclude_salic') !== 'false');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1));
  const [inputValue, setInputValue] = useState(search);

  const filters = {
    search: search || undefined,
    area: area || undefined,
    type: type || undefined,
    deadline: sort,
    source: source || undefined,
    sourceExclude: !source && excludeSalic ? 'SALIC' : undefined,
    page,
    limit: 12,
  };

  const { data, isLoading, isError, refetch } = useOpportunities(filters);

  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') params.delete(k);
        else params.set(k, v);
      }
      params.set('page', '1');
      router.push(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  function handleSearch() {
    setSearch(inputValue);
    setPage(1);
    updateUrl({ search: inputValue || null });
  }

  function handleAreaChange(next: string) {
    setArea(next);
    setPage(1);
    updateUrl({ area: next || null });
  }

  function handleTypeChange(next: OpportunityFilterType) {
    setType(next);
    setPage(1);
    updateUrl({ type: next || null });
  }

  function handleSortChange(next: DeadlineSort) {
    setSort(next);
    setPage(1);
    updateUrl({ deadline: next });
  }

  function handleSourceChange(next: string) {
    setSource(next);
    setPage(1);
    updateUrl({ source: next || null });
  }

  function handleExcludeSalicChange(next: boolean) {
    setExcludeSalic(next);
    setPage(1);
    updateUrl({ exclude_salic: next ? null : 'false' });
  }

  const opportunities = data?.data ?? [];
  const meta = data?.meta;
  const hasFilters = Boolean(search || area || type || source);

  return (
    <div className="bg-background min-h-screen">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="from-primary-50 to-background bg-gradient-to-b pb-8 pt-12">
        <div className="container-content">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-balance text-3xl font-bold text-gray-900 sm:text-4xl">
              Encontre recursos públicos para <span className="text-primary">sua organização</span>
            </h1>
            <p className="mt-3 text-base text-gray-600">
              Editais, leis de incentivo e chamamentos públicos monitorados diariamente.
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-2xl">
            <SearchBar value={inputValue} onChange={setInputValue} onSubmit={handleSearch} />
          </div>
        </div>
      </section>

      {/* ── Filters bar ────────────────────────────────────────────────── */}
      <div className="bg-background/95 sticky top-16 z-30 border-b border-gray-100 backdrop-blur-sm">
        <div className="container-content space-y-3 py-3">
          {/* Type tabs */}
          <TypeFilterTabs selected={type} onChange={handleTypeChange} />

          {/* Área + Fonte + Ordenar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <AreaFilterChips selected={area} onChange={handleAreaChange} />
              <SourceFilterChips selected={source} onChange={handleSourceChange} />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Toggle excluir SALIC */}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={excludeSalic}
                  onChange={(e) => handleExcludeSalicChange(e.target.checked)}
                  className="accent-primary h-4 w-4 rounded"
                />
                Apenas editais abertos
              </label>

              <div className="flex items-center gap-2">
                <label htmlFor="sort" className="shrink-0 text-sm font-medium text-gray-500">
                  Ordenar:
                </label>
                <select
                  id="sort"
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value as DeadlineSort)}
                  className="focus:ring-primary rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1"
                >
                  <option value="asc">Prazo: mais urgente</option>
                  <option value="desc">Prazo: mais distante</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      <main className="container-content py-6">
        {/* Count */}
        {!isLoading && meta && (
          <p className="mb-4 text-sm text-gray-500">
            <span className="font-semibold text-gray-700">{meta.total}</span>{' '}
            {meta.total === 1 ? 'oportunidade encontrada' : 'oportunidades encontradas'}
          </p>
        )}

        {isLoading ? (
          <OpportunityGridSkeleton count={12} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : opportunities.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {opportunities.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={cn(
                'rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium transition-colors',
                page === 1
                  ? 'cursor-not-allowed text-gray-300'
                  : 'hover:border-primary hover:text-primary text-gray-700',
              )}
            >
              ← Anterior
            </button>

            <span className="text-sm text-gray-500">
              {page} de {meta.pages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
              disabled={page === meta.pages}
              className={cn(
                'rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium transition-colors',
                page === meta.pages
                  ? 'cursor-not-allowed text-gray-300'
                  : 'hover:border-primary hover:text-primary text-gray-700',
              )}
            >
              Próxima →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
