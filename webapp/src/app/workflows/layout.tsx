"use client";

import { SectionLayout } from "@/components/layouts/section-layout";

const workflowItems = [
  {
    id: "automation-folder",
    title: "Automations",
    href: "/workflows/automations",
    type: "folder" as const,
    items: [
      {
        id: "email-automation",
        title: "Email Sequences",
        href: "/workflows/automations/email",
        type: "view" as const,
      },
      {
        id: "notification-automation",
        title: "Notifications",
        href: "/workflows/automations/notifications",
        type: "view" as const,
      },
    ],
  },
  {
    id: "triggers-folder",
    title: "Triggers",
    href: "/workflows/triggers",
    type: "folder" as const,
    items: [
      {
        id: "event-triggers",
        title: "Event Triggers",
        href: "/workflows/triggers/events",
        type: "view" as const,
      },
      {
        id: "schedule-triggers",
        title: "Scheduled Triggers",
        href: "/workflows/triggers/schedules",
        type: "view" as const,
      },
    ],
  },
  {
    id: "all-workflows",
    title: "All Workflows",
    href: "/workflows",
    type: "view" as const,
  },
  {
    id: "workflow-logs",
    title: "Workflow Logs",
    href: "/workflows/logs",
    type: "view" as const,
  },
];

export default function WorkflowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SectionLayout
      secondaryNavItems={workflowItems}
      onCreateFolder={() => console.log("Create workflow folder")}
      onCreateView={() => console.log("Create workflow view")}
    >
      {children}
    </SectionLayout>
  );
}
