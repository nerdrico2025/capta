'use client';

import { forwardRef } from 'react';

function maskCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

interface CnpjInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (raw: string, masked: string) => void;
  hasError?: boolean;
}

export const CnpjInput = forwardRef<HTMLInputElement, CnpjInputProps>(
  ({ value, onChange, hasError, className = '', ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '');
      const masked = maskCnpj(e.target.value);
      onChange(raw, masked);
    };

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={maskCnpj(value)}
        onChange={handleChange}
        maxLength={18}
        placeholder="00.000.000/0000-00"
        className={[
          'w-full rounded-xl border px-4 py-3 text-lg tracking-widest placeholder:tracking-normal placeholder:text-gray-400',
          'focus:outline-none focus:ring-2',
          hasError
            ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
            : 'focus:border-primary focus:ring-primary/20 border-gray-200',
          className,
        ].join(' ')}
      />
    );
  },
);

CnpjInput.displayName = 'CnpjInput';
