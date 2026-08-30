import { z } from "zod";

/**
 * Settings that belong to the person rather than to any one mindmap.
 *
 * A preference earns a place here when it changes how *every* map is read and
 * the answer is the same on every device the person opens the app on — which
 * is why it is stored on the server rather than in `localStorage`. The canvas
 * derives node positions from the layout below, so this is not a view toggle
 * the browser can keep to itself: the positions it produces are saved back
 * into the mindmap, and two devices disagreeing about the direction would keep
 * rewriting each other's.
 */

/**
 * Which way a tree grows away from its root: **down** the screen, the way an
 * org chart does, or **right** across it, the way an outline does.
 *
 * Named for the direction of growth rather than for the axis, because that is
 * what the user picks — "top to bottom" and "left to right" are the same two
 * choices said in words. The values double as the layout's own vocabulary: the
 * canvas asks whether the tree grows `down` or `right` and derives which axis
 * carries depth and which carries siblings from that one answer.
 */
export const LAYOUT_DIRECTIONS = ["down", "right"] as const;

export type LayoutDirection = (typeof LAYOUT_DIRECTIONS)[number];

/**
 * What a mindmap looks like before anybody has an opinion — and what every map
 * created before this preference existed is still laid out as, since a stored
 * preference is only written when someone changes it.
 */
export const DEFAULT_LAYOUT_DIRECTION: LayoutDirection = "down";

/**
 * On-screen names for the two directions, here for the same reason
 * `SOCIAL_PROVIDER_LABELS` is: the API validates the value and the web app
 * renders it, so a label kept only in the web app would be a second source of
 * truth for a word the two share.
 */
export const LAYOUT_DIRECTION_LABELS: Record<LayoutDirection, string> = {
  down: "Top to bottom",
  right: "Left to right",
};

export const preferencesSchema = z.object({
  layoutDirection: z.enum(LAYOUT_DIRECTIONS),
});

/**
 * PATCH semantics, the same shape `updateMindmapSchema` uses: every field is
 * optional so a client can send the one it changed, but an empty body is a
 * no-op and almost always a bug, so it is rejected rather than accepted.
 */
export const updatePreferencesSchema = preferencesSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type Preferences = z.infer<typeof preferencesSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

/** Every preference at its default — what `GET /api/me` answers with. */
export const DEFAULT_PREFERENCES: Preferences = {
  layoutDirection: DEFAULT_LAYOUT_DIRECTION,
};

export function isLayoutDirection(value: string): value is LayoutDirection {
  return (LAYOUT_DIRECTIONS as readonly string[]).includes(value);
}
