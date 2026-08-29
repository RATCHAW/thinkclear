import { useSyncExternalStore } from "react";
import {
  parseWorkspaceRoute,
  workspaceRouteUrl,
  type WorkspaceRoute,
} from "@/lib/workspace-route";

/**
 * The address bar, bound to React.
 *
 * `window.location` is the store — nothing here mirrors it. `getRoute` reads it
 * live on every call and memoizes the parse by URL string, so the object
 * identity is stable while the URL is (safe in a dependency array) and the app
 * always shows what the URL says, whether it got there through a navigation
 * below, a Back press, or a page load on a deep link.
 *
 * Navigation is a set of named transitions rather than a generic setter: the
 * rules about what closes what live in one place, and calls that change two
 * things at once (open a mindmap, put the library away) stay a single history
 * entry instead of two.
 */

const listeners = new Set<() => void>();
let lastUrl = "";
let lastRoute = parseWorkspaceRoute("/");

function currentUrl(): string {
  return window.location.pathname + window.location.search;
}

function getRoute(): WorkspaceRoute {
  const url = currentUrl();
  if (url !== lastUrl) {
    lastUrl = url;
    lastRoute = parseWorkspaceRoute(url);
  }
  return lastRoute;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("popstate", notify);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("popstate", notify);
  };
}

export function useWorkspaceRoute(): WorkspaceRoute {
  return useSyncExternalStore(subscribe, getRoute);
}

/**
 * Moves to a route described as a patch over the current one. Every move
 * pushes a history entry — on a workspace where opening things *is* the
 * navigation, Back undoing the last thing you opened is what the button is
 * expected to do.
 *
 * `replace` is for the exception: a move that rearranges what is already open
 * rather than opening anything. Raising a note window is the only one, and it
 * happens on every click into a window — pushing there would fill history with
 * entries for looking at things.
 */
function navigate(
  patch: Partial<WorkspaceRoute>,
  { replace = false } = {},
): void {
  const url = workspaceRouteUrl({ ...getRoute(), ...patch });
  if (url === currentUrl()) return;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  notify();
}

/**
 * Opens a mindmap on the canvas, and puts the library away — that is where the
 * choice is made. `null` clears the canvas.
 *
 * Open notes go with it: the ids in `note` name topics of the map being left,
 * and carrying them across would point them at whatever topics happen to share
 * those ids in the next one.
 */
export function openMindmap(mindmapId: string | null): void {
  navigate({ mindmapId, libraryOpen: false, noteNodeIds: [] });
}

export function setLibraryOpen(libraryOpen: boolean): void {
  navigate({ libraryOpen });
}

/**
 * Closing the assistant puts history away with it, so reopening always lands
 * on the conversation rather than on whatever list was left showing. That falls
 * out of the URL grammar, which can't write history without the panel.
 */
export function setAssistantOpen(assistantOpen: boolean): void {
  navigate({ assistantOpen });
}

export function setHistoryOpen(historyOpen: boolean): void {
  // History is a layer over the chat, so showing it implies an open panel.
  navigate(
    historyOpen
      ? { historyOpen: true, assistantOpen: true }
      : { historyOpen: false },
  );
}

/**
 * Points the assistant at a stored conversation, or at a new chat with `null`.
 * Either way the choice has been made, so the history list steps aside.
 */
export function openConversation(conversationId: string | null): void {
  navigate({ conversationId, historyOpen: false });
}

/**
 * Opens a topic's note in a window of its own, in front of whatever is already
 * up. Notes float over the canvas rather than taking a side of it, so nothing
 * closes to make room — which is the point: notes are read against each other.
 *
 * A note that is already open is raised instead of opened twice, which makes
 * this the only call a "show me this note" affordance needs, whether or not it
 * happens to be buried under three others.
 */
export function openNote(nodeId: string): void {
  const { noteNodeIds } = getRoute();
  if (noteNodeIds.includes(nodeId)) {
    raiseNote(nodeId);
    return;
  }
  navigate({ noteNodeIds: [...noteNodeIds, nodeId] });
}

/**
 * Brings a note window to the front. Replaces rather than pushes: this fires
 * on every press into a window, and Back should undo opening a note, not
 * looking at one.
 */
export function raiseNote(nodeId: string): void {
  const { noteNodeIds } = getRoute();
  if (noteNodeIds.at(-1) === nodeId) return;
  navigate(
    { noteNodeIds: [...noteNodeIds.filter((id) => id !== nodeId), nodeId] },
    { replace: true },
  );
}

export function closeNote(nodeId: string): void {
  const { noteNodeIds } = getRoute();
  navigate({ noteNodeIds: noteNodeIds.filter((id) => id !== nodeId) });
}
