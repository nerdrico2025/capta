'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useOrg } from '@/context/OrgContext';
import { useSavedOpportunities } from '@/hooks/useSavedOpportunities';
import { formatDate, formatValue, getDeadlineInfo } from '@/lib/format';
import type { Opportunity } from '@/types/api';

// ─── Export helpers ───────────────────────────────────────────────────────────

function statusLabel(deadline: string): string {
  return new Date(deadline) > new Date() ? 'Aberto' : 'Encerrado';
}

function formatMonthYear(): string {
  return new Intl.DateTimeFormat('pt-BR', { month: '2-digit', year: 'numeric' }).format(new Date());
}

async function exportToPDF(opportunities: Opportunity[]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header bar
  doc.setFillColor(15, 76, 129);
  doc.rect(0, 0, 297, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('CAPTA', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 210, 240);
  doc.text('Recursos Públicos para Organizações da Sociedade Civil', 38, 14);

  // Title section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 76, 129);
  doc.text('Meus Editais Salvos', 14, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Exportado em ${formatMonthYear()} via Capta  •  ${opportunities.length} oportunidade${opportunities.length !== 1 ? 's' : ''}`,
    14,
    41,
  );

  autoTable(doc, {
    startY: 48,
    head: [['Título', 'Fonte', 'Prazo', 'Valor', 'Áreas', 'Status']],
    body: opportunities.map((opp) => [
      opp.title,
      opp.source,
      formatDate(opp.deadline),
      formatValue(opp.value),
      opp.areas.slice(0, 3).join(', ') + (opp.areas.length > 3 ? ` +${opp.areas.length - 3}` : ''),
      statusLabel(opp.deadline),
    ]),
    headStyles: {
      fillColor: [15, 76, 129],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5, cellPadding: 3 },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40 },
      2: { cellWidth: 28 },
      3: { cellWidth: 30 },
      4: { cellWidth: 60 },
      5: { cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const val = String(data.cell.raw);
        data.cell.styles.textColor = val === 'Aberto' ? [5, 150, 105] : [100, 100, 100];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    foot: [
      [
        {
          content: `Exportado em ${formatMonthYear()} via Capta — capta.app.br`,
          colSpan: 6,
          styles: {
            fillColor: [245, 245, 240],
            textColor: [150, 150, 150],
            fontSize: 7.5,
            halign: 'center',
          },
        },
      ],
    ],
    showFoot: 'lastPage',
  });

  doc.save(`editais-salvos-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exportToCSV(opportunities: Opportunity[]) {
  const headers = ['Título', 'Fonte', 'Tipo', 'Prazo', 'Valor (R$)', 'Áreas', 'Status'];
  const rows = opportunities.map((opp) => [
    `"${opp.title.replace(/"/g, '""')}"`,
    `"${opp.source.replace(/"/g, '""')}"`,
    opp.type,
    formatDate(opp.deadline),
    opp.value != null ? String(opp.value) : '',
    `"${opp.areas.join('; ')}"`,
    statusLabel(opp.deadline),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `editais-salvos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ deadline }: { deadline: string }) {
  const isOpen = new Date(deadline) > new Date();
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500',
      ].join(' ')}
    >
      <span
        className={['h-1.5 w-1.5 rounded-full', isOpen ? 'bg-emerald-500' : 'bg-gray-400'].join(
          ' ',
        )}
      />
      {isOpen ? 'Aberto' : 'Encerrado'}
    </span>
  );
}

function OpportunityRow({ opp }: { opp: Opportunity }) {
  const deadline = getDeadlineInfo(opp.deadline);

  return (
    <article className="shadow-card hover:shadow-card-hover hover:border-primary/20 group flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 transition-all sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge deadline={opp.deadline} />
          <span className="text-xs capitalize text-gray-400">{opp.type.toLowerCase()}</span>
        </div>
        <h3 className="font-display group-hover:text-primary line-clamp-2 text-sm font-semibold text-gray-900 transition-colors">
          {opp.title}
        </h3>
        <p className="mt-1 text-xs text-gray-500">{opp.source}</p>

        {/* Areas */}
        {opp.areas.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {opp.areas.slice(0, 3).map((area) => (
              <span
                key={area}
                className="bg-primary/8 text-primary rounded-full px-2 py-0.5 text-xs font-medium capitalize"
              >
                {area}
              </span>
            ))}
            {opp.areas.length > 3 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                +{opp.areas.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 flex-row gap-4 sm:flex-col sm:items-end sm:text-right">
        <div>
          <p className="mb-0.5 text-xs text-gray-400">Prazo</p>
          <p
            className={[
              'text-sm font-semibold',
              deadline.urgency === 'expired'
                ? 'text-gray-400'
                : deadline.urgency === 'critical'
                  ? 'text-red-600'
                  : 'text-gray-800',
            ].join(' ')}
          >
            {formatDate(opp.deadline)}
          </p>
          <p
            className={[
              'text-xs',
              deadline.badgeClass.replace('bg-', 'text-').split(' ')[1] ?? 'text-gray-500',
            ].join(' ')}
          >
            {deadline.label}
          </p>
        </div>
        <div>
          <p className="mb-0.5 text-xs text-gray-400">Valor</p>
          <p className="text-sm font-semibold text-gray-800">{formatValue(opp.value)}</p>
        </div>
        <Link
          href={`/opportunity/${opp.id}`}
          className="border-primary/30 text-primary hover:bg-primary hidden items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:text-white sm:inline-flex"
        >
          {opp.type === 'LEI'
            ? 'Ver projeto'
            : opp.type === 'PRIVADO'
              ? 'Ver oportunidade'
              : 'Ver edital'}
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </Link>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="bg-primary/8 mb-5 flex h-20 w-20 items-center justify-center rounded-2xl">
        <svg
          className="text-primary/50 h-9 w-9"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
          />
        </svg>
      </div>
      <h3 className="font-display text-lg font-semibold text-gray-800">
        Nenhuma oportunidade salva ainda
      </h3>
      <p className="mt-2 max-w-xs text-sm text-gray-500">
        Explore as oportunidades disponíveis e salve as que têm mais a ver com sua organização.
      </p>
      <Link
        href="/"
        className="bg-primary hover:bg-primary-dark mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors"
      >
        Explorar oportunidades
      </Link>
    </div>
  );
}

function NotOnboarded() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50">
        <svg
          className="h-9 w-9 text-amber-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h3 className="font-display text-lg font-semibold text-gray-800">
        Organização não identificada
      </h3>
      <p className="mt-2 max-w-xs text-sm text-gray-500">
        Para visualizar seus editais salvos, primeiro cadastre sua organização.
      </p>
      <Link
        href="/cadastro"
        className="bg-primary hover:bg-primary-dark mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors"
      >
        Cadastrar organização
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SavedContent() {
  const { cnpj, name, isOnboarded } = useOrg();
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  const { data, isLoading, isError, refetch } = useSavedOpportunities(cnpj, page);

  if (!isOnboarded) return <NotOnboarded />;

  async function handleExportPDF() {
    if (!data?.data.length) return;
    setExporting('pdf');
    try {
      await exportToPDF(data.data);
    } finally {
      setExporting(null);
    }
  }

  function handleExportCSV() {
    if (!data?.data.length) return;
    setExporting('csv');
    exportToCSV(data.data);
    setTimeout(() => setExporting(null), 500);
  }

  const opportunities = data?.data ?? [];
  const meta = data?.meta;
  const hasOpportunities = opportunities.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            Meus Editais Salvos
          </h1>
          {name && (
            <p className="mt-1 text-sm text-gray-500">
              {name}
              {meta && (
                <span className="bg-primary/8 text-primary ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold">
                  {meta.total} {meta.total === 1 ? 'oportunidade' : 'oportunidades'}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Export buttons */}
        {hasOpportunities && (
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={handleExportCSV}
              disabled={exporting !== null}
              className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting === 'csv' ? (
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
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
              )}
              CSV
            </button>

            <button
              onClick={handleExportPDF}
              disabled={exporting !== null}
              className="bg-primary hover:bg-primary-dark flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            >
              {exporting === 'pdf' ? (
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
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              )}
              Exportar PDF
            </button>
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-gray-100 bg-white"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-8 text-center">
          <p className="text-sm font-medium text-red-600">Erro ao carregar oportunidades.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 text-sm text-red-700 underline hover:no-underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : !hasOpportunities ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-3">
            {opportunities.map((opp) => (
              <OpportunityRow key={opp.id} opp={opp} />
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500">
                Página {meta.page} de {meta.pages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={meta.page <= 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                  disabled={meta.page >= meta.pages}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
