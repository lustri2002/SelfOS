"use client";

import dynamic from "next/dynamic";
import type { Database } from "@/types/database";

type Note = Database["public"]["Tables"]["notes"]["Row"];
type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

const NoteEditor = dynamic(() => import("./NoteEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      Caricamento editor...
    </div>
  ),
});

export default function NoteEditorClient({
  note,
  notebooks,
  projects = [],
}: {
  note: Note;
  notebooks: Notebook[];
  projects?: Project[];
}) {
  return <NoteEditor note={note} notebooks={notebooks} projects={projects} />;
}
