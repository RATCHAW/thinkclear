import { Injectable, type MessageEvent } from "@nestjs/common";
import { filter, interval, map, merge, Subject, type Observable } from "rxjs";
import {
  MINDMAP_CHANGED_EVENT,
  type MindmapChangedEvent,
} from "@thinkclear/shared";

/**
 * An idle SSE connection is indistinguishable from a dead one to every proxy
 * on the way (Vercel's rewrite, Coolify's, nginx), and each is free to cut a
 * stream that says nothing for too long. The heartbeat keeps the connection
 * visibly alive; EventSource ignores event types nothing listens for.
 */
export const SSE_HEARTBEAT_MS = 15_000;

/**
 * In-process fan-out from writes to the SSE streams watching them. A single
 * subject is enough because the API is one process — if it ever scales past
 * one instance, this is the seam where a shared channel goes.
 */
@Injectable()
export class EventsService {
  private readonly changes = new Subject<
    { ownerId: string } & MindmapChangedEvent
  >();

  emitMindmapChanged(ownerId: string, event: MindmapChangedEvent) {
    this.changes.next({ ownerId, ...event });
  }

  /**
   * One subscriber's view of the stream: their own mindmaps' changes — the
   * `ownerId` filter is the same scoping rule every query in
   * `MindmapsService` follows — plus the heartbeat.
   */
  forOwner(ownerId: string): Observable<MessageEvent> {
    return merge(
      this.changes.pipe(
        filter((change) => change.ownerId === ownerId),
        map(({ mindmapId, updatedAt }): MessageEvent => ({
          type: MINDMAP_CHANGED_EVENT,
          data: { mindmapId, updatedAt } satisfies MindmapChangedEvent,
        })),
      ),
      interval(SSE_HEARTBEAT_MS).pipe(
        map((): MessageEvent => ({ type: "ping", data: "" })),
      ),
    );
  }
}
