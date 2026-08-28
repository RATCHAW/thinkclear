import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, Model } from "mongoose";
import {
  findMindmapGraphIssues,
  ROOT_NODE_ID,
  type GraphEdgeRef,
  type GraphNodeRef,
  type UpdateMindmapInput,
} from "@mindmap/shared";
import { Mindmap, MindmapDocument } from "./mindmap.schema";

@Injectable()
export class MindmapsService {
  constructor(
    @InjectModel(Mindmap.name) private readonly mindmapModel: Model<Mindmap>,
  ) {}

  // A mindmap is never empty: it is born with a root node carrying the map's
  // title, so opening a fresh map drops the user straight into a canvas with
  // something to branch from.
  create(ownerId: string, title: string) {
    return this.mindmapModel.create({
      ownerId,
      title,
      nodes: [{ id: ROOT_NODE_ID, title, x: 0, y: 0 }],
      edges: [],
    });
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

  /**
   * The zod schema only vouches for the shape of the body; whether the result
   * is still a mindmap is a question about the whole graph, so the check runs
   * on the patch merged onto what is stored. The editor always sends both
   * arrays and needs no read; a client sending only one — dropping a node
   * without the edges into it, say — is checked against the half it left
   * alone, and pays a read for it.
   */
  async update(ownerId: string, id: string, input: UpdateMindmapInput) {
    if (input.nodes && input.edges) {
      this.assertValidGraph(input.nodes, input.edges);
    } else if (input.nodes || input.edges) {
      const stored = await this.findOne(ownerId, id);
      this.assertValidGraph(
        input.nodes ?? stored.nodes,
        input.edges ?? stored.edges,
      );
    }
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
   * Reported the way `ZodValidationPipe` reports a bad body — one 400 carrying
   * every issue — so a client repairing a generated graph sees the whole list
   * instead of one problem per round trip.
   */
  private assertValidGraph(
    nodes: readonly GraphNodeRef[],
    edges: readonly GraphEdgeRef[],
  ) {
    const issues = findMindmapGraphIssues(nodes, edges);
    if (issues.length) {
      throw new BadRequestException({ message: "Invalid mindmap graph", issues });
    }
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
