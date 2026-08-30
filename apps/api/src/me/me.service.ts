import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  DEFAULT_LAYOUT_DIRECTION,
  type Preferences as PreferencesInput,
  type UpdatePreferencesInput,
} from "@thinkclear/shared";
import { Preferences, PreferencesDocument } from "./preferences.schema";

@Injectable()
export class MeService {
  constructor(
    @InjectModel(Preferences.name)
    private readonly preferencesModel: Model<Preferences>,
  ) {}

  /**
   * Reading preferences can't 404: somebody who has never opened settings has
   * no document, which is not a miss but the answer "everything as it comes".
   */
  async findPreferences(ownerId: string): Promise<PreferencesInput> {
    return shape(await this.preferencesModel.findOne({ ownerId }).exec());
  }

  /**
   * Upserted, so the first change is what creates the document — there is no
   * point writing a row of defaults for every account that signs up. The
   * filter's `ownerId` seeds the insert, which is also what makes the unique
   * index on it the guard against a double-write racing itself.
   */
  async updatePreferences(
    ownerId: string,
    input: UpdatePreferencesInput,
  ): Promise<PreferencesInput> {
    return shape(
      await this.preferencesModel
        .findOneAndUpdate(
          { ownerId },
          { $set: input },
          {
            new: true,
            upsert: true,
          },
        )
        .exec(),
    );
  }
}

/**
 * The stored document read as a complete set of preferences. Every field falls
 * back to its default individually, so a document written before a preference
 * existed answers for it too — which is what lets `updatePreferences` store
 * only what was actually changed.
 */
function shape(stored: PreferencesDocument | null): PreferencesInput {
  return {
    layoutDirection: stored?.layoutDirection ?? DEFAULT_LAYOUT_DIRECTION,
  };
}
