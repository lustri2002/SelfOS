"use client";

import dynamic from "next/dynamic";
import PageLoading from "@/components/ui/PageLoading";

const HelpView = dynamic(() => import("./HelpView"), {
  ssr: false,
  loading: () => <PageLoading titleWidth="w-32" subtitleWidth="w-80" cards={3} rows={4} />,
});

export default function HelpViewLazy() {
  return <HelpView />;
}
