export function createTiptapDoc(text = "") {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}

export function isTiptapDoc(value: unknown): value is ReturnType<typeof createTiptapDoc> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      (value as { type?: unknown }).type === "doc",
  );
}
