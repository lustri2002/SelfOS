"use client";

import dynamic from "next/dynamic";
import PageLoading from "@/components/ui/PageLoading";
import type { TrashViewProps } from "@/components/notes/TrashView";

const TrashView = dynamic(() => import("./TrashView"), {
  ssr: false,
  loading: () => <PageLoading titleWidth="w-24" subtitleWidth="w-72" cards={1} rows={5} />,
});

export default function TrashViewLazy(props: TrashViewProps) {
  return <TrashView {...props} />;
}
