"use client";

import { SectionLayout } from "@/components/layouts/section-layout";

const customerItems = [
  {
    id: "trials-folder",
    title: "Trials",
    href: "/customers/trials",
    type: "folder" as const,
    items: [
      {
        id: "active-trials",
        title: "Active Trials",
        href: "/customers/trials/active",
        type: "view" as const,
      },
      {
        id: "failed-trials",
        title: "Failed Trials",
        href: "/customers/trials/failed",
        type: "view" as const,
      },
    ],
  },
  {
    id: "customers-folder",
    title: "Customers",
    href: "/customers/list",
    type: "folder" as const,
    items: [
      {
        id: "active-customers",
        title: "Active Customers",
        href: "/customers/list/active",
        type: "view" as const,
      },
      {
        id: "churned-customers",
        title: "Churned Customers",
        href: "/customers/list/churned",
        type: "view" as const,
      },
      {
        id: "top-20",
        title: "Top 20",
        href: "/customers/list/top-20",
        type: "view" as const,
      },
    ],
  },
];

export default function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SectionLayout
      secondaryNavItems={customerItems}
      onCreateFolder={() => console.log("Create customer folder")}
      onCreateView={() => console.log("Create customer view")}
      defaultSelection={"/customers/list/top-20"}
    >
      {children}
    </SectionLayout>
  );
}
