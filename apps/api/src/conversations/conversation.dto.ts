import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Documentation-only mirrors of the zod schemas in packages/shared, same as
 * the mindmap DTOs — these exist for Swagger and therefore for the web types.
 */
export class CreateConversationDto {
  @ApiPropertyOptional({
    example: "Plan a launch mindmap",
    minLength: 1,
    maxLength: 200,
    description:
      'Defaults to "New chat". The web app passes the first message, shortened.',
  })
  title?: string;
}

export class UpdateConversationDto {
  @ApiProperty({ example: "Launch planning", minLength: 1, maxLength: 200 })
  title: string;
}

/** A row in the history list: everything except the messages themselves. */
export class ConversationSummaryDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  ownerId: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({
    description:
      "Bumped by every chat turn, so it doubles as the last-used time the history list sorts on.",
  })
  updatedAt: string;
}

export class ConversationDto extends ConversationSummaryDto {
  @ApiProperty({
    description:
      "AI SDK UIMessage array. See https://ai-sdk.dev — the shape is owned by the `ai` package and stored as sent.",
    type: "array",
    items: { type: "object", additionalProperties: true },
  })
  messages: Record<string, unknown>[];
}
