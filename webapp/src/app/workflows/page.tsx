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

export default function SessionsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#2a2a2a] mb-4">
        Session Replays
      </h1>
      <p className="text-[#666666]">
        Select a session category from the sidebar to view replays.
      </p>
    </div>
  );
}
