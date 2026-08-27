import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, Model } from "mongoose";
import type { UpdateMindmapInput } from "@mindmap/shared";
import { Mindmap, MindmapDocument } from "./mindmap.schema";

@Injectable()
export class MindmapsService {
  constructor(
    @InjectModel(Mindmap.name) private readonly mindmapModel: Model<Mindmap>,
  ) {}

  create(ownerId: string, title: string) {
    return this.mindmapModel.create({ ownerId, title });
  }

  findAllByOwner(ownerId: string) {
    return this.mindmapModel.find({ ownerId }).sort({ createdAt: -1 }).exec();
  }

  async findOne(ownerId: string, id: string) {
    return this.orNotFound(
      isValidObjectId(id)
        ? await this.mindmapModel.findOne({ _id: id, ownerId }).exec()
        : null,
    );
  }

  async update(ownerId: string, id: string, input: UpdateMindmapInput) {
    return this.orNotFound(
      isValidObjectId(id)
        ? await this.mindmapModel
            .findOneAndUpdate({ _id: id, ownerId }, input, { new: true })
            .exec()
        : null,
    );
  }

  async remove(ownerId: string, id: string) {
    this.orNotFound(
      isValidObjectId(id)
        ? await this.mindmapModel.findOneAndDelete({ _id: id, ownerId }).exec()
        : null,
    );
  }

  /**
   * Every query above is scoped by `ownerId`, so someone else's mindmap and a
   * mindmap that never existed are indistinguishable from the outside — a 404
   * either way, which is what keeps ids from leaking across accounts. A
   * malformed id short-circuits here too, otherwise Mongoose throws a CastError
   * and Nest turns it into a 500.
   */
  private orNotFound(mindmap: MindmapDocument | null): MindmapDocument {
    if (!mindmap) throw new NotFoundException("Mindmap not found");
    return mindmap;
  }
}
