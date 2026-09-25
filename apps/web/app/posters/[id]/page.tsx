import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PosterResult } from './poster-result';

export const metadata: Metadata = { title: 'আপনার পোস্টার — পোস্টার মেকার' };

export default function PosterPage() {
  return (
    // PosterResult reads ?new= with useSearchParams, which needs a Suspense boundary.
    <Suspense>
      <PosterResult />
    </Suspense>
  );
}
