import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

// Subdocuments carry their own client-generated `id`, so Mongo's per-item
// `_id` would just be a second, unused identity.
@Schema({ _id: false })
export class MindmapNode {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: Number, required: true })
  x: number;

  @Prop({ type: Number, required: true })
  y: number;

  /**
   * Markdown source for the topic's note. Optional and never stored empty —
   * writers omit the key — so `node.note` being falsy is the whole "has no
   * note" check, on the server and on the canvas alike.
   */
  @Prop({ type: String })
  note?: string;
}

@Schema({ _id: false })
export class MindmapEdge {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: String, required: true })
  source: string;

  @Prop({ type: String, required: true })
  target: string;
}

@Schema({ timestamps: true, collection: "mindmaps" })
export class Mindmap {
  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true, index: true })
  ownerId: string;

  @Prop({ type: [SchemaFactory.createForClass(MindmapNode)], default: [] })
  nodes: MindmapNode[];

  @Prop({ type: [SchemaFactory.createForClass(MindmapEdge)], default: [] })
  edges: MindmapEdge[];

  // Written by `timestamps: true`, declared (without @Prop — Mongoose owns the
  // path) so reads of `doc.updatedAt` type-check.
  updatedAt: Date;
}

export type MindmapDocument = HydratedDocument<Mindmap>;
export const MindmapSchema = SchemaFactory.createForClass(Mindmap);
