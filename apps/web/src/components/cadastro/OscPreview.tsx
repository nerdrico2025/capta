import type { OscProfile } from '@/types/api';

const SIZE_LABEL: Record<string, string> = {
  MICRO: 'Microporte',
  SMALL: 'Pequeno porte',
  MEDIUM: 'Médio porte',
  LARGE: 'Grande porte',
};

interface OscPreviewProps {
  osc: OscProfile;
}

export function OscPreview({ osc }: OscPreviewProps) {
  return (
    <div className="border-accent/30 bg-accent/5 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <div className="bg-accent/20 text-accent-dark flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <svg
            className="h-5 w-5"
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
        <div className="min-w-0 flex-1">
          <p className="text-accent-dark text-xs font-semibold uppercase tracking-wide">
            Organização encontrada
          </p>
          <p className="mt-0.5 font-semibold leading-tight text-gray-900">{osc.name}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {osc.size && (
              <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {SIZE_LABEL[osc.size] ?? osc.size}
              </span>
            )}
            {osc.city && osc.state && (
              <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {osc.city} — {osc.state}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
