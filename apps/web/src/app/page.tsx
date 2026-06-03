import { Suspense } from 'react';
import { HomeContent } from '@/components/home/HomeContent';
import { OpportunityGridSkeleton } from '@/components/opportunity/OpportunityCardSkeleton';
import { Header } from '@/components/layout/Header';

function HomeLoadingFallback() {
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <section className="from-primary-50 to-background bg-gradient-to-b pb-8 pt-12">
        <div className="container-content">
          <div className="mx-auto max-w-2xl">
            <div className="h-14 w-full animate-pulse rounded-2xl bg-gray-200" />
          </div>
        </div>
      </section>
      <div className="container-content py-6">
        <OpportunityGridSkeleton count={12} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<HomeLoadingFallback />}>
      <HomeContent />
    </Suspense>
  );
}
