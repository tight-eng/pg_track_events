import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { LayersIcon } from 'lucide-react';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <LayersIcon className="w-4 h-4" />
        pg_track_events
      </>
    ),
  },
};
