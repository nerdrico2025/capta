import { Suspense } from 'react';
import { RouanetContent } from './RouanetContent';

export const dynamic = 'force-dynamic';

export default function RouanetPage() {
  return (
    <Suspense>
      <RouanetContent />
    </Suspense>
  );
}
