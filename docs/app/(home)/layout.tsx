import type { ReactNode } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/app/layout.config';

export default function Layout({ children }: { children: ReactNode }) {
  return <HomeLayout links={[
    {
      text: 'Documentation',
      url: '/docs',
      active: 'nested-url',
      on: 'nav',
    },
    {
      text: 'GitHub',
      url: 'https://github.com/tight-eng/pg_track_events',
      active: 'nested-url',
      on: 'nav',
    },
  ]} {...baseOptions}>{children}</HomeLayout>;
}

export const runtime = "edge";
