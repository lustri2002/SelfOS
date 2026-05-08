"use client";

import dynamic from "next/dynamic";
import PageLoading from "@/components/ui/PageLoading";
import type { NotesListProps } from "@/components/notes/NotesList";

const NotesList = dynamic(() => import("./NotesList"), {
  ssr: false,
  loading: () => <PageLoading titleWidth="w-28" subtitleWidth="w-72" cards={2} rows={8} />,
});

export default function NotesListLazy(props: NotesListProps) {
  return <NotesList {...props} />;
}
