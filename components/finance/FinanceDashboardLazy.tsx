"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import type { FinanceDashboardProps } from "@/components/finance/FinanceDashboard";

const FinanceDashboard = dynamic(() => import("./FinanceDashboard"), {
  ssr: false,
  loading: () => (
    <div className="p-4 md:p-8 space-y-4">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  ),
});

export default function FinanceDashboardLazy(props: FinanceDashboardProps) {
  return <FinanceDashboard {...props} />;
}
