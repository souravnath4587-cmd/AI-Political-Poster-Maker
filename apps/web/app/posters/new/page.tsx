import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PosterForm } from './poster-form';

export const metadata: Metadata = { title: 'নতুন পোস্টার — পোস্টার মেকার' };

export default function NewPosterPage() {
  return (
    // PosterForm reads ?template= with useSearchParams, which needs a Suspense boundary.
    <Suspense>
      <PosterForm />
    </Suspense>
  );
}
