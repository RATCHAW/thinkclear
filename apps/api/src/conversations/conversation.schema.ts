import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

@Schema({ timestamps: true, collection: "conversations" })
export class Conversation {
  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true, index: true })
  ownerId: string;

  /**
   * The AI SDK's `UIMessage[]`, stored verbatim as opaque documents.
   *
   * The shape belongs to the `ai` package — text parts, tool calls with their
   * inputs and outputs, message metadata — and it moves with the library.
   * Re-declaring it as a Mongoose schema would freeze this collection to one
   * SDK version and quietly drop every field a newer one adds, so the store
   * holds what the client sent and `validateUIMessages` is what vouches for it
   * on the way back in.
   */
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  messages: Record<string, unknown>[];
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// The history list is "most recently used first", which is a sort every
// signed-in session runs on page load.
ConversationSchema.index({ ownerId: 1, updatedAt: -1 });
