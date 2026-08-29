import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import {
  ApiOkResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "@thallesp/nestjs-better-auth";
import type { Connection } from "mongoose";

/** Mongoose's numeric `readyState`, in the words the answer uses. */
const CONNECTION_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
  99: "uninitialized",
};

export class HealthResponseDto {
  @ApiProperty({ example: "ok" })
  status: string;

  @ApiProperty({
    description: "The Mongo connection's state",
    example: "connected",
  })
  database: string;

  @ApiProperty({
    description: "Seconds since this process started",
    example: 1837,
  })
  uptime: number;
}

/**
 * What a deployment asks before it sends traffic here.
 *
 * The container's `HEALTHCHECK` and Coolify's own probe both read this, which
 * is why it answers 503 rather than 200-with-a-flag when Mongo is gone: a
 * rollout whose database is unreachable has not succeeded, and a body nobody
 * parses cannot say so. Every other route in this app would fail anyway — they
 * all read or write a document — so reporting the connection is reporting
 * whether the API can do its job.
 *
 * `@Public()` for the usual reason: the global session guard would answer a
 * probe with 401, which is a *working* API refusing an anonymous caller, and
 * indistinguishable from a broken one. Nothing here is user data — a state
 * word and this process' age, both identical for every caller.
 */
@Public()
@ApiTags("health")
@Controller("api/health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({
    description: "The API is up but its database is not reachable",
    type: HealthResponseDto,
  })
  check(): HealthResponseDto {
    const database = CONNECTION_STATES[this.connection.readyState] ?? "unknown";
    const uptime = Math.round(process.uptime());

    if (this.connection.readyState !== 1) {
      throw new ServiceUnavailableException({
        status: "degraded",
        database,
        uptime,
      });
    }

    return { status: "ok", database, uptime };
  }
}
