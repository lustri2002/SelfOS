"use client";

import dynamic from "next/dynamic";

/**
 * Defers the CommandPalette bundle (~20KB + deps like Fuse.js if used).
 * The palette is hidden until ⌘K — there's no reason to ship its JS
 * on the initial navigation.
 *
 * Must live in a "use client" module because `next/dynamic` with
 * `ssr: false` is not allowed inside Server Components.
 */
const CommandPalette = dynamic(() => import("./CommandPalette"), {
  ssr: false,
});

export default function CommandPaletteLazy() {
  return <CommandPalette />;
}
