import type { Metadata } from 'next';
import { RegisterWizard } from '@/components/cadastro/RegisterWizard';

export const metadata: Metadata = {
  title: 'Cadastro',
  description: 'Cadastre sua organização para receber alertas de editais e oportunidades.',
};

export default function CadastroPage() {
  return (
    <main className="bg-background min-h-screen px-4 py-12">
      <RegisterWizard />
    </main>
  );
}
