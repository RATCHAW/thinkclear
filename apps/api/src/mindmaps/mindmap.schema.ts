import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "mindmaps" })
export class Mindmap {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, index: true })
  ownerId: string;
}

export type MindmapDocument = HydratedDocument<Mindmap>;
export const MindmapSchema = SchemaFactory.createForClass(Mindmap);
