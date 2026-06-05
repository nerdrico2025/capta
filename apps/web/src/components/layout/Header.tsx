'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useOrg } from '@/context/OrgContext';

function OrgBadge({
  name,
  cnpj,
  onSignOut,
}: {
  name: string;
  cnpj: string;
  onSignOut: () => void;
}) {
  const formatted = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-semibold leading-tight text-gray-800">{name}</p>
        <p className="text-xs text-gray-400">{formatted}</p>
      </div>
      <button
        onClick={onSignOut}
        title="Sair"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500"
      >
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
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      </button>
    </div>
  );
}

const NAV_LINKS = [
  { href: '/', label: 'Oportunidades' },
  { href: '/rouanet', label: 'Lei Rouanet' },
  { href: '/submit', label: 'Submeter Edital' },
] as const;

export function Header() {
  const { isOnboarded, name, cnpj, clearOrg } = useOrg();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="container-content flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" aria-hidden>
              <path
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-display group-hover:text-primary text-xl font-bold text-gray-900 transition-colors">
            Capta
          </span>
          <span className="bg-accent-100 text-accent-dark hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline-block">
            beta
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <Link key={href} href={href as any} className="hover:text-primary transition-colors">
              {label}
            </Link>
          ))}
          {isOnboarded && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <Link
              href={'/opportunities/saved' as any}
              className="hover:text-primary transition-colors"
            >
              Meus Editais
            </Link>
          )}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isOnboarded ? (
            <OrgBadge name={name} cnpj={cnpj} onSignOut={clearOrg} />
          ) : (
            <Link
              href="/cadastro"
              className="border-primary text-primary hover:bg-primary-50 hidden rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors md:inline-flex"
            >
              Cadastrar organização
            </Link>
          )}

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:hidden"
          >
            {menuOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-5 w-5"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-5 w-5"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href as any}
                onClick={() => setMenuOpen(false)}
                className="hover:text-primary hover:bg-primary-50 rounded-lg px-3 py-2.5 transition-colors"
              >
                {label}
              </Link>
            ))}
            {isOnboarded && (
              <Link
                href={'/opportunities/saved' as any}
                onClick={() => setMenuOpen(false)}
                className="hover:text-primary hover:bg-primary-50 rounded-lg px-3 py-2.5 transition-colors"
              >
                Meus Editais
              </Link>
            )}
            {!isOnboarded && (
              <Link
                href="/cadastro"
                onClick={() => setMenuOpen(false)}
                className="bg-primary mt-1 rounded-lg px-3 py-2.5 text-center font-semibold text-white"
              >
                Cadastrar organização
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
