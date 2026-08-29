import { lazy } from "react";

/**
 * The markdown renderer's chunk boundary, in one place because two surfaces
 * load it — the hover preview and the note window's Preview tab — and a second
 * `lazy()` over the same module would be a second component type, so moving
 * between them would tear down ProseMirror and build it again for nothing.
 *
 * Tiptap and ProseMirror are about as much JavaScript as the canvas itself and
 * none of it is needed to paint a mindmap, which is why it is split out at all.
 * Writing a note needs none of it either: the Edit tab is a plain textarea, so
 * this only loads when a note is actually read.
 */
export const NoteMarkdown = lazy(async () => ({
  default: (await import("@/components/note-markdown")).NoteMarkdown,
}));

/**
 * Warms the chunk on canvas mount, the way the assistant's is warmed on
 * workspace mount — so the first hover over a topic that has a note renders it
 * rather than showing a spinner while a network round trip happens.
 */
export function prefetchNoteMarkdown(): void {
  void import("@/components/note-markdown");
}
