import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import {
  DEFAULT_LAYOUT_DIRECTION,
  LAYOUT_DIRECTIONS,
  type LayoutDirection,
} from "@thinkclear/shared";

/**
 * One document per person, in a collection of its own rather than as extra
 * fields on Better Auth's `user` document: that collection belongs to the auth
 * library, and app state kept in it would be state an auth migration could
 * move. Keyed by `ownerId`, the same way every other owned resource is.
 *
 * A row only exists once somebody has changed something, so "no document" is
 * the ordinary case and means the defaults rather than a missing user.
 */
@Schema({ timestamps: true, collection: "preferences" })
export class Preferences {
  @Prop({ type: String, required: true, unique: true })
  ownerId: string;

  @Prop({
    type: String,
    enum: LAYOUT_DIRECTIONS,
    required: true,
    default: DEFAULT_LAYOUT_DIRECTION,
  })
  layoutDirection: LayoutDirection;
}

export type PreferencesDocument = HydratedDocument<Preferences>;
export const PreferencesSchema = SchemaFactory.createForClass(Preferences);
