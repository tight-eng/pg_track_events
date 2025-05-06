import PostgresEventTrackingFlow from '@/components/home/PostgresEventTrackingFlow';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'pg_track_events - Accurate analytics straight from your database',
  description: 'Your database knows what happened — why aren\'t you listening? pg_track_events emits analytics events as your data changes.',
  metadataBase: new URL('https://tight.sh'),
};

export default function HomePage() {
  return (
    <main>
      <PostgresEventTrackingFlow />
    </main>
  );
}
