'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { z } from 'zod';
import { submitOpportunity } from '@/lib/api';
import { AREAS } from '@/lib/areas';

// ─── Validation schema ────────────────────────────────────────────────────────

const schema = z.object({
  instituteName: z.string().min(3, 'Mínimo 3 caracteres'),
  cnpj: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido (ex: 00.000.000/0001-00)'),
  title: z.string().min(5, 'Mínimo 5 caracteres'),
  areas: z.array(z.string()).min(1, 'Selecione ao menos uma área'),
  deadline: z
    .string()
    .min(1, 'Prazo é obrigatório')
    .refine((d) => new Date(d) > new Date(), 'O prazo deve ser uma data futura'),
  value: z
    .string()
    .refine((v) => v !== '' && !isNaN(Number(v)) && Number(v) > 0, 'Informe um valor positivo'),
  currency: z.enum(['BRL', 'USD']),
  officialLink: z.string().url('Informe uma URL válida (ex: https://...)'),
  portalLink: z.union([z.string().url('URL inválida'), z.literal('')]).optional(),
  description: z.string().min(200, 'Mínimo 200 caracteres'),
});

type FormData = z.infer<typeof schema>;
type FormErrors = Partial<Record<keyof FormData, string>>;

const INITIAL: FormData = {
  instituteName: '',
  cnpj: '',
  title: '',
  areas: [],
  deadline: '',
  value: '',
  currency: 'BRL',
  officialLink: '',
  portalLink: '',
  description: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-gray-100 pb-5">
      <span className="bg-primary font-display flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
        {number}
      </span>
      <div>
        <h2 className="font-display text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-600">{message}</p>;
}

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-xl border-2 bg-white px-4 py-3 text-sm text-gray-900 transition-colors',
    'placeholder:text-gray-400',
    'focus:outline-none focus:ring-0',
    hasError ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-primary',
  ].join(' ');
}

// ─── PDF Dropzone ─────────────────────────────────────────────────────────────

function PdfDropzone({
  file,
  onFile,
  error,
  onError,
}: {
  file: File | null;
  onFile: (f: File) => void;
  error: string;
  onError: (e: string) => void;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) {
        onFile(accepted[0]);
        onError('');
      }
    },
    [onFile, onError],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
    onDropRejected: (files) => {
      const code = files[0]?.errors[0]?.code;
      if (code === 'file-too-large') onError('Arquivo muito grande. Máximo 10 MB.');
      else if (code === 'file-invalid-type') onError('Somente arquivos PDF são aceitos.');
      else onError('Arquivo inválido.');
    },
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={[
          'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : file
              ? 'border-accent bg-accent/5'
              : 'hover:border-primary/50 hover:bg-primary/5 border-gray-200 bg-gray-50',
        ].join(' ')}
      >
        <input {...getInputProps()} />

        {file ? (
          <>
            <div className="bg-accent/15 flex h-12 w-12 items-center justify-center rounded-full">
              <svg
                className="text-accent-dark h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="max-w-xs truncate text-sm font-semibold text-gray-800">{file.name}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFile(file);
              }}
              className="text-primary text-xs underline hover:no-underline"
            >
              Trocar arquivo
            </button>
          </>
        ) : (
          <>
            <div
              className={[
                'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
                isDragActive ? 'bg-primary/15' : 'bg-gray-100',
              ].join(' ')}
            >
              <svg
                className={[
                  'h-6 w-6 transition-colors',
                  isDragActive ? 'text-primary' : 'text-gray-400',
                ].join(' ')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o PDF ou clique para selecionar'}
              </p>
              <p className="mt-1 text-xs text-gray-400">PDF • máximo 10 MB • opcional</p>
            </div>
          </>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="bg-accent/15 mb-6 flex h-20 w-20 items-center justify-center rounded-full">
        <svg
          className="text-accent-dark h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h2 className="font-display text-2xl font-bold text-gray-900">Edital recebido!</h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-500">
        Seu edital foi enviado com sucesso e será revisado pela nossa equipe em até{' '}
        <strong className="text-gray-700">48 horas</strong>. Você receberá um e-mail de confirmação
        após a aprovação.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={onReset}
          className="rounded-xl border-2 border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          Submeter outro edital
        </button>
        <a
          href="/"
          className="bg-primary hover:bg-primary-dark rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Ver oportunidades
        </a>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SubmitForm() {
  const [data, setData] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [serverError, setServerError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleArea(value: string) {
    const next = data.areas.includes(value)
      ? data.areas.filter((a) => a !== value)
      : [...data.areas, value];
    set('areas', next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = schema.safeParse(data);
    if (!result.success) {
      const errs: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FormData;
        if (!errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      const firstErr = document.querySelector('[data-field-error]');
      firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setStatus('loading');
    setServerError('');

    try {
      await submitOpportunity({
        instituteName: data.instituteName,
        instituteCnpj: data.cnpj.replace(/\D/g, ''),
        title: data.title,
        areas: data.areas,
        deadline: data.deadline,
        value: Number(data.value),
        currency: data.currency,
        officialLink: data.officialLink,
        portalLink: data.portalLink || undefined,
        description: data.description,
        pdfFileName: pdfFile?.name,
      });
      setSubmitted(true);
    } catch (err) {
      setStatus('idle');
      setServerError(err instanceof Error ? err.message : 'Erro ao enviar. Tente novamente.');
    }
  }

  if (submitted) {
    return (
      <SuccessScreen
        onReset={() => {
          setData(INITIAL);
          setPdfFile(null);
          setSubmitted(false);
        }}
      />
    );
  }

  const descLen = data.description.length;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-10">
      {/* ── Section 1: Instituto ────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeader
          number="01"
          title="Sobre o instituto"
          subtitle="Dados do instituto ou fundação responsável pelo edital"
        />

        <div data-field-error={errors.instituteName}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Nome do instituto / fundação <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="ex: Instituto Moreira Salles"
            value={data.instituteName}
            onChange={(e) => set('instituteName', e.target.value)}
            className={inputCls(!!errors.instituteName)}
          />
          <FieldError message={errors.instituteName} />
        </div>

        <div data-field-error={errors.cnpj}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            CNPJ do instituto <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="00.000.000/0001-00"
            value={data.cnpj}
            onChange={(e) => set('cnpj', maskCnpj(e.target.value))}
            className={inputCls(!!errors.cnpj)}
            maxLength={18}
          />
          <FieldError message={errors.cnpj} />
        </div>
      </section>

      {/* ── Section 2: Edital ───────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeader
          number="02"
          title="Sobre o edital"
          subtitle="Informações detalhadas do programa de financiamento"
        />

        <div data-field-error={errors.title}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Título do edital <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="ex: Programa de Apoio à Cultura — 2026"
            value={data.title}
            onChange={(e) => set('title', e.target.value)}
            className={inputCls(!!errors.title)}
          />
          <FieldError message={errors.title} />
        </div>

        {/* Areas */}
        <div data-field-error={errors.areas}>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Área(s) temática(s) <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AREAS.map((area) => {
              const isSelected = data.areas.includes(area.value);
              return (
                <button
                  key={area.value}
                  type="button"
                  onClick={() => toggleArea(area.value)}
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
          <FieldError message={errors.areas} />
        </div>

        {/* Deadline + Value */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div data-field-error={errors.deadline}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Prazo de inscrição <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              min={tomorrow()}
              value={data.deadline}
              onChange={(e) => set('deadline', e.target.value)}
              className={inputCls(!!errors.deadline)}
            />
            <FieldError message={errors.deadline} />
          </div>

          <div data-field-error={errors.value}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Valor máximo por projeto <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={data.currency}
                onChange={(e) => set('currency', e.target.value as 'BRL' | 'USD')}
                className="focus:border-primary rounded-xl border-2 border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-700 transition-colors focus:outline-none"
              >
                <option value="BRL">R$</option>
                <option value="USD">US$</option>
              </select>
              <input
                type="number"
                min="1"
                step="any"
                placeholder="50000"
                value={data.value}
                onChange={(e) => set('value', e.target.value)}
                className={[inputCls(!!errors.value), 'flex-1'].join(' ')}
              />
            </div>
            <FieldError message={errors.value} />
          </div>
        </div>
      </section>

      {/* ── Section 3: Links & Materiais ────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeader
          number="03"
          title="Links e materiais"
          subtitle="Endereços e documentação do edital"
        />

        <div data-field-error={errors.officialLink}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Link do edital oficial <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            placeholder="https://www.instituto.org.br/edital-2026"
            value={data.officialLink}
            onChange={(e) => set('officialLink', e.target.value)}
            className={inputCls(!!errors.officialLink)}
          />
          <FieldError message={errors.officialLink} />
        </div>

        <div data-field-error={errors.portalLink}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Link do portal de candidatura
            <span className="ml-1.5 text-xs font-normal text-gray-400">(opcional)</span>
          </label>
          <input
            type="url"
            placeholder="https://inscricoes.instituto.org.br"
            value={data.portalLink}
            onChange={(e) => set('portalLink', e.target.value)}
            className={inputCls(!!errors.portalLink)}
          />
          <FieldError message={errors.portalLink} />
        </div>

        {/* Description */}
        <div data-field-error={errors.description}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Descrição completa <span className="text-red-500">*</span>
            </label>
            <span
              className={[
                'text-xs font-medium tabular-nums',
                descLen >= 200 ? 'text-accent-dark' : 'text-gray-400',
              ].join(' ')}
            >
              {descLen}/200 mín.
            </span>
          </div>
          <textarea
            rows={7}
            placeholder="Descreva os objetivos do edital, quem pode se candidatar, critérios de seleção, contrapartidas esperadas..."
            value={data.description}
            onChange={(e) => set('description', e.target.value)}
            className={[inputCls(!!errors.description), 'min-h-[140px] resize-y'].join(' ')}
          />
          {descLen > 0 && descLen < 200 && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="bg-primary/50 h-full rounded-full transition-all"
                style={{ width: `${(descLen / 200) * 100}%` }}
              />
            </div>
          )}
          <FieldError message={errors.description} />
        </div>

        {/* PDF Upload */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            PDF do edital
            <span className="ml-1.5 text-xs font-normal text-gray-400">(opcional)</span>
          </label>
          <PdfDropzone file={pdfFile} onFile={setPdfFile} error={pdfError} onError={setPdfError} />
        </div>
      </section>

      {/* ── Submit ──────────────────────────────────────────────────── */}
      {serverError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-100 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-400">
          Campos marcados com <span className="text-red-500">*</span> são obrigatórios. Seu edital
          será publicado após revisão da equipe Capta.
        </p>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-primary hover:bg-primary-dark flex items-center justify-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:flex-shrink-0"
        >
          {status === 'loading' ? (
            <>
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
              Enviando...
            </>
          ) : (
            'Submeter edital'
          )}
        </button>
      </div>
    </form>
  );
}
