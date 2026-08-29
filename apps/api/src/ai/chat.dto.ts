import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Documentation-only mirror of `chatRequestSchema` (packages/shared), same as
 * the mindmap DTOs. The `messages` payload is the AI SDK's `UIMessage` shape,
 * which the SDK owns — it is documented as an opaque array on purpose.
 */
export class ChatRequestDto {
  @ApiPropertyOptional({ description: "Chat session id from the AI SDK" })
  id?: string;

  @ApiProperty({
    description:
      "Conversation this turn belongs to. Must be one of the caller's own conversations; the route appends the turn to it. Create one with POST /api/conversations first.",
  })
  conversationId: string;

  @ApiPropertyOptional({
    description:
      "Id of the mindmap currently open in the canvas, used as conversation context",
    nullable: true,
  })
  mindmapId?: string | null;

  @ApiProperty({
    description:
      "AI SDK UIMessage array. See https://ai-sdk.dev — the shape is owned by the `ai` package and streamed back as a UI message event stream.",
    type: "array",
    items: { type: "object", additionalProperties: true },
  })
  messages: Record<string, unknown>[];
}
