import { Mark, markInputRule, mergeAttributes } from "@tiptap/core";

/**
 * Regex that matches `[[something]]` wiki-style links as input.
 * Group 1: the full match including brackets `[[something]]`
 * Group 2: the inner text `something`
 */
const noteLinkInputRegex = /(\[\[([^\]]+)\]\])$/;

const NoteLink = Mark.create({
  name: "noteLink",

  addAttributes() {
    return {
      href: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-note-link]' },
      { tag: 'a[class="note-link"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { href, ...rest } = HTMLAttributes;
    return [
      "span",
      mergeAttributes(rest, {
        class: "note-link",
        "data-note-link": href,
      }),
      0,
    ];
  },

  addInputRules() {
    return [
      markInputRule({
        find: noteLinkInputRegex,
        type: this.type,
        getAttributes: (match) => {
          return { href: match[2] };
        },
      }),
    ];
  },
});

export default NoteLink;
