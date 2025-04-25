"use client";

import { SectionLayout } from "@/components/layouts/section-layout";

const dashboardItems = [
  {
    id: "customer-folder",
    title: "Customer Analytics",
    href: "/dashboards/customers",
    type: "folder" as const,
    items: [
      {
        id: "customer-overview",
        title: "Customer Overview",
        href: "/dashboards/customers/overview",
        type: "view" as const,
      },
      {
        id: "customer-segments",
        title: "Customer Segments",
        href: "/dashboards/customers/segments",
        type: "view" as const,
      },
    ],
  },
  {
    id: "product-folder",
    title: "Product Analytics",
    href: "/dashboards/products",
    type: "folder" as const,
    items: [
      {
        id: "product-performance",
        title: "Product Performance",
        href: "/dashboards/products/performance",
        type: "view" as const,
      },
      {
        id: "feature-adoption",
        title: "Feature Adoption",
        href: "/dashboards/products/adoption",
        type: "view" as const,
      },
    ],
  },
  {
    id: "main-dashboard",
    title: "Main Dashboard",
    href: "/dashboards/main",
    type: "view" as const,
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
    >
      {children}
    </SectionLayout>
  );
}
