import type { OpportunityType } from '@/types/api';
import { cn } from '@/lib/cn';

interface SourceBadgeProps {
  source: string;
  type: OpportunityType;
  className?: string;
}

const TYPE_STYLES: Record<OpportunityType, string> = {
  EDITAL: 'bg-primary-50 text-primary border-primary-100',
  LEI: 'bg-purple-50 text-purple-700 border-purple-100',
  PRIVADO: 'bg-accent-50 text-accent-dark border-accent-100',
};

const TYPE_DOT: Record<OpportunityType, string> = {
  EDITAL: 'bg-primary',
  LEI: 'bg-purple-600',
  PRIVADO: 'bg-accent',
};

export function SourceBadge({ source, type, className }: SourceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TYPE_STYLES[type] ?? TYPE_STYLES.EDITAL,
        className,
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', TYPE_DOT[type] ?? TYPE_DOT.EDITAL)}
        aria-hidden
      />
      {source}
    </span>
  );
}
