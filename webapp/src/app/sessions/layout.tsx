"use client";
import { SectionLayout } from "@/components/layouts/section-layout";

const sessionItems = [
  {
    id: "error-folder",
    title: "Error Sessions",
    href: "/sessions/errors",
    type: "folder" as const,
    items: [
      {
        id: "critical-errors",
        title: "Critical Errors",
        href: "/sessions/errors/critical",
        type: "view" as const,
      },
      {
        id: "user-reported",
        title: "User Reported",
        href: "/sessions/errors/reported",
        type: "view" as const,
      },
    ],
  },
  {
    id: "conversion-folder",
    title: "Conversion Analysis",
    href: "/sessions/conversion",
    type: "folder" as const,
    items: [
      {
        id: "checkout-flow",
        title: "Checkout Flow",
        href: "/sessions/conversion/checkout",
        type: "view" as const,
      },
      {
        id: "signup-flow",
        title: "Signup Flow",
        href: "/sessions/conversion/signup",
        type: "view" as const,
      },
    ],
  },
  {
    id: "recent-sessions",
    title: "Recent Sessions",
    href: "/sessions/recent",
    type: "view" as const,
  },
];

export default function SessionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SectionLayout
      secondaryNavItems={sessionItems}
      onCreateFolder={() => console.log("Create session folder")}
      onCreateView={() => console.log("Create session view")}
    >
      {children}
    </SectionLayout>
  );
}
