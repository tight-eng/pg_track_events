"use client";

import { SectionLayout } from "@/components/layouts/section-layout";

const dashboardItems = [
  {
    id: "revenue-dashboard",
    title: "Revenue",
    href: "/dashboards/revenue",
    type: "view" as const,
  },
  {
    id: "product-analytics",
    title: "Product Analytics",
    href: "/dashboards/products",
    type: "folder" as const,
    items: [
      {
        id: "search-analytics",
        title: "Conversion Time",
        href: "/dashboards/products/first-session-setup",
        type: "view" as const,
      },
      {
        id: "checkout-performance",
        title: "Checkout Flow Performance",
        href: "/dashboards/products/checkout-performance",
        type: "view" as const,
      },
      {
        id: "user-authentication",
        title: "Authentication System Metrics",
        href: "/dashboards/products/auth-metrics",
        type: "view" as const,
      },
    ],
  },
];

export default function DashboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SectionLayout
      secondaryNavItems={dashboardItems}
      onCreateFolder={() => console.log("Create dashboard folder")}
      onCreateView={() => console.log("Create dashboard view")}
      defaultSelection={"/dashboards/products/first-session-setup"}
    >
      {children}
    </SectionLayout>
  );
}
