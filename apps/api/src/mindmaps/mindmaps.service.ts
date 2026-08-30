import {
  BadRequestException,
  Inject,
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
} from "@thinkclear/shared";
import { EventsService } from "../events/events.service";
import { Mindmap, MindmapDocument } from "./mindmap.schema";

@Injectable()
export class MindmapsService {
  constructor(
    @InjectModel(Mindmap.name) private readonly mindmapModel: Model<Mindmap>,
    @Inject(EventsService) private readonly events: EventsService,
  ) {}

  // A mindmap is never empty: it is born with a root node carrying the map's
  // title, so opening a fresh map drops the user straight into a canvas with
  // something to branch from.
  async create(ownerId: string, title: string) {
    const mindmap = await this.mindmapModel.create({
      ownerId,
      title,
      nodes: [{ id: ROOT_NODE_ID, title, x: 0, y: 0 }],
      edges: [],
    });
    this.changed(mindmap);
    return mindmap;
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
    const updated = this.orNotFound(
      isValidObjectId(id)
        ? await this.mindmapModel
            .findOneAndUpdate({ _id: id, ownerId }, input, { new: true })
            .exec()
        : null,
    );
    this.changed(updated);
    return updated;
  }

  async remove(ownerId: string, id: string) {
    const removed = this.orNotFound(
      isValidObjectId(id)
        ? await this.mindmapModel.findOneAndDelete({ _id: id, ownerId }).exec()
        : null,
    );
    this.events.emitMindmapChanged(removed.ownerId, {
      mindmapId: String(removed._id),
      updatedAt: null,
    });
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
      throw new BadRequestException({
        message: "Invalid mindmap graph",
        issues,
      });
    }
  }

  /**
   * Announces a successful write on the owner's SSE stream. Sitting here
   * rather than in a controller is what makes the stream complete: the HTTP
   * routes, the assistant's tools, and the MCP transport all write through
   * these three methods, so none of them can change a mindmap silently.
   */
  private changed(mindmap: MindmapDocument) {
    this.events.emitMindmapChanged(mindmap.ownerId, {
      mindmapId: String(mindmap._id),
      updatedAt: mindmap.updatedAt.toISOString(),
    });
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
