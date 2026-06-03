import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { SavedContent } from '@/components/saved/SavedContent';

export const metadata: Metadata = {
  title: 'Meus Editais Salvos',
  description: 'Visualize e exporte as oportunidades que você salvou.',
};

export default function SavedOpportunitiesPage() {
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="container-content py-10 md:py-14">
        <SavedContent />
      </main>
    </div>
  );
}
