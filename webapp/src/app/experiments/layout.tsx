import { SectionLayout } from "@/components/layouts/section-layout";

export default function ExperimentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const secondaryNavItems = [
    { title: "All Experiments", href: "/experiments" },
    { title: "A/B Tests", href: "/experiments/ab-tests" },
    { title: "Feature Flags", href: "/experiments/feature-flags" },
    { title: "Results", href: "/experiments/results" },
  ];

  return (
    <SectionLayout secondaryNavItems={secondaryNavItems}>
      {children}
    </SectionLayout>
  );
}
