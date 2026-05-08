"use client";

import dynamic from "next/dynamic";
import PageLoading from "@/components/ui/PageLoading";
import type { TaskManagerProps } from "@/components/tasks/TaskManager";

const TaskManager = dynamic(() => import("./TaskManager"), {
  ssr: false,
  loading: () => <PageLoading titleWidth="w-32" subtitleWidth="w-72" cards={3} rows={8} />,
});

export default function TaskManagerLazy(props: TaskManagerProps) {
  return <TaskManager {...props} />;
}
