import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { SubmitForm } from '@/components/submit/SubmitForm';

export const metadata: Metadata = {
  title: 'Submeter Edital',
  description: 'Cadastre um edital privado para organizações da sociedade civil.',
};

export default function SubmitPage() {
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main>
        {/* Hero */}
        <div className="from-primary-50 to-background border-b border-gray-100 bg-gradient-to-b">
          <div className="container-content py-10 md:py-14">
            <div className="max-w-2xl">
              <span className="border-primary/20 bg-primary/5 text-primary mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
                <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                Para institutos e fundações privadas
              </span>
              <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
                Publique seu edital na plataforma
              </h1>
              <p className="mt-3 text-base leading-relaxed text-gray-500">
                Alcance centenas de organizações da sociedade civil qualificadas para o seu programa
                de financiamento. Seu edital será revisado em até&nbsp;
                <strong className="text-gray-700">48 horas</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="container-content py-10 md:py-14">
          <div className="max-w-2xl">
            <SubmitForm />
          </div>
        </div>
      </main>
    </div>
  );
}
