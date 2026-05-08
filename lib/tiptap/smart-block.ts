import { Node, mergeAttributes, type CommandProps } from "@tiptap/core";

export type SmartBlockKind =
  | "idea"
  | "decision"
  | "action"
  | "question"
  | "risk"
  | "goal"
  | "meeting"
  | "resource";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    smartBlock: {
      setSmartBlock: (options: { kind: SmartBlockKind; label: string; text?: string }) => ReturnType;
    };
  }
}

export const SmartBlock = Node.create({
  name: "smartBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: "idea",
        parseHTML: (element) => element.getAttribute("data-smart-block") || "idea",
      },
      label: {
        default: "Idea",
        parseHTML: (element) => element.getAttribute("data-smart-label") || "Idea",
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-smart-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: `smart-block smart-block-${HTMLAttributes.kind || "idea"}`,
        "data-smart-block": HTMLAttributes.kind || "idea",
        "data-smart-label": HTMLAttributes.label || "Idea",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSmartBlock:
        (options: { kind: SmartBlockKind; label: string; text?: string }) =>
        ({ commands, state }: CommandProps) => {
          const { from, to } = state.selection;
          const text = options.text?.trim();

          return commands.insertContentAt(
            { from, to },
            [
              {
                type: this.name,
                attrs: {
                  kind: options.kind,
                  label: options.label,
                },
                content: [
                  {
                    type: "paragraph",
                    content: text ? [{ type: "text", text }] : [],
                  },
                ],
              },
              {
                type: "paragraph",
              },
            ],
          );
        },
    };
  },
});
