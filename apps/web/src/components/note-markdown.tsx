import { memo, useEffect, useRef } from "react";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/**
 * Deliberately the small half of markdown: headings, emphasis, lists, quotes,
 * code, links, rules. A note is prose hanging off a title, not a document, and
 * every one of these has a spelling short enough to type without thinking.
 *
 * Underline is off because markdown has no way to write it — there would be no
 * source that produces it, so rendering it would be rendering something the
 * user cannot ask for.
 */
const NOTE_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    underline: false,
    // Nothing here is editable, so nothing should intercept a click on a link:
    // with this off, the anchor Tiptap rendered is just an anchor and the
    // browser follows it. Protocols are validated by the extension, and the
    // anchor carries `target="_blank" rel="noopener noreferrer nofollow"`.
    link: { openOnClick: false },
  }),
  Markdown,
];

/**
 * Markdown, rendered. Read-only by construction — the note is *written* as
 * source in a textarea, so this side never needs a cursor.
 *
 * One renderer serves both places a note is read: the hover preview on a topic
 * and the note window's Preview tab. That is the point — a preview that could
 * drift from the other preview would be worse than no preview.
 *
 * Reached through `note-markdown-lazy.ts`, never imported directly, so the
 * ProseMirror stack stays out of the entry chunk.
 */
export const NoteMarkdown = memo(function NoteMarkdown({
  markdown,
  label,
}: {
  markdown: string;
  label?: string;
}) {
  const editor = useEditor(
    {
      extensions: NOTE_EXTENSIONS,
      content: markdown,
      contentType: "markdown",
      editable: false,
      editorProps: {
        attributes: {
          class: "note-prose",
          ...(label ? { "aria-label": label } : {}),
        },
      },
    },
    // Built once; the effect below re-parses into it rather than rebuilding.
    [],
  );

  const applied = useRef(markdown);
  useEffect(() => {
    if (markdown === applied.current) return;
    applied.current = markdown;
    editor.commands.setContent(markdown, {
      contentType: "markdown",
      emitUpdate: false,
    });
  }, [editor, markdown]);

  return <EditorContent editor={editor} />;
});
