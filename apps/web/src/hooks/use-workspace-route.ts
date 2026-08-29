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
 */
function navigate(patch: Partial<WorkspaceRoute>): void {
  const url = workspaceRouteUrl({ ...getRoute(), ...patch });
  if (url === currentUrl()) return;
  window.history.pushState(null, "", url);
  notify();
}

/**
 * Opens a mindmap on the canvas, and puts the library away — that is where the
 * choice is made. `null` clears the canvas.
 */
export function openMindmap(mindmapId: string | null): void {
  navigate({ mindmapId, libraryOpen: false });
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
