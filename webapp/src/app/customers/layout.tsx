"use client";

import { SectionLayout } from "@/components/layouts/section-layout";

const customerItems = [
  {
    id: "segments-folder",
    title: "Customer Segments",
    href: "/customers/segments",
    type: "folder" as const,
    items: [
      {
        id: "active-segments",
        title: "Active Segments",
        href: "/customers/segments/active",
        type: "view" as const,
      },
      {
        id: "segment-builder",
        title: "Segment Builder",
        href: "/customers/segments/builder",
        type: "view" as const,
      },
    ],
  },
  {
    id: "journey-folder",
    title: "Customer Journey",
    href: "/customers/journey",
    type: "folder" as const,
    items: [
      {
        id: "journey-map",
        title: "Journey Map",
        href: "/customers/journey/map",
        type: "view" as const,
      },
      {
        id: "touchpoints",
        title: "Touchpoints",
        href: "/customers/journey/touchpoints",
        type: "view" as const,
      },
    ],
  },
  {
    id: "all-customers",
    title: "All Customers",
    href: "/customers",
    type: "view" as const,
  },
  {
    id: "profiles",
    title: "Customer Profiles",
    href: "/customers/profiles",
    type: "view" as const,
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
    >
      {children}
    </SectionLayout>
  );
}
