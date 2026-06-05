import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { RegisterWizard } from '@/components/cadastro/RegisterWizard';

export const metadata: Metadata = {
  title: 'Cadastro',
  description: 'Cadastre sua organização para receber alertas de editais e oportunidades.',
};

export default function CadastroPage() {
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="container-content py-12">
        <RegisterWizard />
      </main>
    </div>
  );
}
