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
}

export type MindmapDocument = HydratedDocument<Mindmap>;
export const MindmapSchema = SchemaFactory.createForClass(Mindmap);
