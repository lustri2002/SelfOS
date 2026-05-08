"use client";

import { Node, mergeAttributes, type CommandProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";

/* ── Extend TipTap command types ───────────────────────── */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageBlock: {
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
    };
  }
}

/* ── React component rendered inside the editor ────────── */

function ImageNodeView(props: ReactNodeViewProps) {
  const { node, deleteNode, selected } = props;
  const [hover, setHover] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) || "";
  const imgTitle = (node.attrs.title as string) || "";

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLightbox(true);
  }, []);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNode();
  }, [deleteNode]);

  return (
    <NodeViewWrapper className="image-node-wrapper" data-drag-handle>
      {/* Image container */}
      <div
        className="image-container"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- TipTap node images can be inline data/blob URLs controlled by editor state. */}
        <img
          src={src}
          alt={alt}
          title={imgTitle}
          onClick={handleClick}
          className={`editor-image ${selected ? "selected" : ""}`}
          draggable={false}
        />

        {/* Delete button — appears on hover */}
        {hover && (
          <button
            type="button"
            onClick={handleDelete}
            className="image-delete-btn"
            title="Rimuovi immagine"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Fullscreen lightbox */}
      {lightbox && (
        <div
          className="image-lightbox"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            className="image-lightbox-close"
            onClick={() => setLightbox(false)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- Lightbox reuses the editor image source, which may be a data/blob URL. */}
          <img
            src={src}
            alt={alt}
            className="image-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </NodeViewWrapper>
  );
}

/* ── Custom Image extension using NodeView ─────────────── */

export const ImageBlock = Node.create({
  name: "image",
  group: "block",
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addCommands() {
    return {
      setImage: (options: { src: string; alt?: string; title?: string }) => ({ commands }: CommandProps) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },
});
