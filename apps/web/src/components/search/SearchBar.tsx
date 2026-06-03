'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Buscar editais, fundações, leis de incentivo...',
  className,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      role="search"
      className={cn('relative flex items-center', className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {/* Search icon */}
      <div className="pointer-events-none absolute left-4 text-gray-400">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar oportunidades"
        className={cn(
          'h-14 w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-36 text-base shadow-sm',
          'placeholder:text-gray-400',
          'focus:border-primary focus:ring-primary/20 focus:outline-none focus:ring-2',
          'transition-shadow',
        )}
      />

      {/* Clear */}
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="absolute right-28 text-gray-400 transition-colors hover:text-gray-600"
          aria-label="Limpar busca"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}

      <button
        type="submit"
        className="bg-primary hover:bg-primary-dark absolute right-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
      >
        Buscar
      </button>
    </form>
  );
}
