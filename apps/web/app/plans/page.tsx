import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PlansView } from './plans-view';

export const metadata: Metadata = { title: 'প্ল্যান — পোস্টার মেকার' };

export default function PlansPage() {
  return (
    // PlansView reads ?payment= (the bKash result) with useSearchParams, which needs Suspense.
    <Suspense>
      <PlansView />
    </Suspense>
  );
}
