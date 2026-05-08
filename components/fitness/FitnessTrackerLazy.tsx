"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import type { FitnessTrackerProps } from "@/components/fitness/FitnessTracker";

const FitnessTracker = dynamic(() => import("./FitnessTracker"), {
  ssr: false,
  loading: () => (
    <div className="p-4 md:p-8 space-y-4">
      <Skeleton className="h-10 w-44" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  ),
});

export default function FitnessTrackerLazy(props: FitnessTrackerProps) {
  return <FitnessTracker {...props} />;
}
