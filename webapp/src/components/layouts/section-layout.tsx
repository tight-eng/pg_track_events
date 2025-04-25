"use client";

import { SecondaryNav } from "@/components/navigation/secondary-nav";

interface NavItem {
  id: string;
  title: string;
  href: string;
  type: "view" | "folder";
  items?: NavItem[];
}

interface SectionLayoutProps {
  children: React.ReactNode;
  secondaryNavItems: NavItem[];
  onCreateFolder: () => void;
  onCreateView: () => void;
  defaultSelection?: string;
}

export function SectionLayout({
  children,
  secondaryNavItems,
  onCreateFolder,
  onCreateView,
  defaultSelection,
}: SectionLayoutProps) {
  return (
    <div className="flex h-full">
      <SecondaryNav
        items={secondaryNavItems}
        onCreateFolder={onCreateFolder}
        onCreateView={onCreateView}
        defaultSelection={defaultSelection}
      />
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </div>
    </div>
  );
}
