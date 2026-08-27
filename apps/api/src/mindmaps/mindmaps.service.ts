import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Mindmap } from "./mindmap.schema";

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
}
