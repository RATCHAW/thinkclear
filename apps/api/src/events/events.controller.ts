import { Controller, Header, Inject, Sse } from "@nestjs/common";
import { ApiOkResponse, ApiProduces, ApiTags } from "@nestjs/swagger";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { EventsService } from "./events.service";

/**
 * `GET /api/events` — the browser's live view of server-side writes, one SSE
 * stream per session. Guarded by the ordinary session guard: EventSource
 * cannot set headers, but it doesn't need to — the request is same-origin, so
 * the session cookie rides along like on any other `/api` call.
 *
 * The route is in the OpenAPI document so the contract shows it exists, but
 * like `/api/chat` it cannot be called through the generated client — an SSE
 * stream doesn't ride openapi-fetch. The web app opens it with EventSource.
 */
@ApiTags("events")
@Controller("api/events")
export class EventsController {
  constructor(
    @Inject(EventsService)
    private readonly events: EventsService,
  ) {}

  // `X-Accel-Buffering: no` asks any nginx on the path not to buffer this
  // response even where `proxy_buffering` wasn't turned off for it.
  @Sse()
  @Header("X-Accel-Buffering", "no")
  @ApiProduces("text/event-stream")
  @ApiOkResponse({
    description:
      "Server-sent events. Each `mindmap` event carries { mindmapId, updatedAt } for a mindmap of the signed-in user that changed; updatedAt is null when it was deleted.",
  })
  stream(@Session() session: UserSession) {
    return this.events.forOwner(session.user.id);
  }
}
