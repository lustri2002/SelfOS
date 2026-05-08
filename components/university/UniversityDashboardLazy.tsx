"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UniversityDashboardProps } from "@/components/university/UniversityDashboard";

const UniversityDashboard = dynamic(() => import("./UniversityDashboard"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4 p-4 md:p-8">
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  ),
});

export default function UniversityDashboardLazy(props: UniversityDashboardProps) {
  return <UniversityDashboard {...props} />;
}
