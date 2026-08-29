import {
  FeatureShowcase,
  type ShowcaseItem,
} from "@/components/feature-showcase";
import { BranchIcon, NoteIcon, SparkIcon } from "@/components/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { AssistantMock } from "@/components/visuals/assistant-mock";
import { CanvasMock } from "@/components/visuals/canvas-mock";
import { NoteMock } from "@/components/visuals/note-mock";

const ICON_CLASS = "size-6";

const ITEMS: ShowcaseItem[] = [
  {
    id: "canvas",
    title: "A canvas that stays a tree",
    body: "Drag topics, connect them, rename one in place by double-clicking it. The editor and the API check the same rules, so a map that saves is a map you could have drawn — and cutting a branch strands its subtree on purpose rather than deleting it.",
    icon: <BranchIcon className={ICON_CLASS} />,
    visual: <CanvasMock />,
  },
  {
    id: "assistant",
    title: "An assistant that edits, not just answers",
    body: "It has the whole surface the canvas has: create a map, add ten topics under one branch, move a subtree somewhere else, rename, delete. Every call runs as you, against your maps, through the same checks the HTTP routes use — and the canvas picks the change up without a reload.",
    icon: <SparkIcon className={ICON_CLASS} />,
    visual: <AssistantMock />,
  },
  {
    id: "notes",
    title: "Notes where the thinking actually goes",
    body: "Every topic carries one markdown note in a floating window, and opening one never closes another. Written as source, read as rendered — the way a pull request description is. The windows you have open are in the URL, so a link restores the arrangement.",
    icon: <NoteIcon className={ICON_CLASS} />,
    visual: <NoteMock />,
  },
];

/**
 * `overflow-hidden` on the section clips the decorative blobs. They are
 * positioned outside the card they sit behind — that offset is the effect —
 * and on a phone the overhang is wider than the screen.
 */
export function FeaturesSection() {
  return (
    <section id="features" className="overflow-hidden">
      <div className="mx-auto max-w-page px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeader
          eyebrow="The workspace"
          title="One map. Three ways to fill it."
          body="Type it, drag it, or ask for it. Whichever way a topic gets there, it is the same document underneath — and the next person to touch it can be an agent."
        />
        <FeatureShowcase items={ITEMS} />
      </div>
    </section>
  );
}
