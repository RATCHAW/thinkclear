import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, Model } from "mongoose";
import {
  DEFAULT_CONVERSATION_TITLE,
  MAX_CONVERSATION_MESSAGES,
} from "@thinkclear/shared";
import { Conversation, ConversationDocument } from "./conversation.schema";

/**
 * Chat history. Same ownership shape as `MindmapsService`: every query is
 * scoped by `ownerId` and a miss goes through `orNotFound()`, so somebody
 * else's conversation and one that never existed are the same 404.
 */
@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,
  ) {}

  create(ownerId: string, title?: string) {
    return this.conversationModel.create({
      ownerId,
      title: title?.trim() || DEFAULT_CONVERSATION_TITLE,
      messages: [],
    });
  }

  /**
   * The history list, most recently used first. Messages are projected away:
   * the list is rendered as titles, and a user with a hundred conversations
   * would otherwise pull their entire chat history down to draw a sidebar.
   */
  findAllByOwner(ownerId: string) {
    return this.conversationModel
      .find({ ownerId })
      .select("-messages")
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findOne(ownerId: string, id: string) {
    return this.orNotFound(
      isValidObjectId(id)
        ? await this.conversationModel.findOne({ _id: id, ownerId }).exec()
        : null,
    );
  }

  async rename(ownerId: string, id: string, title: string) {
    return this.orNotFound(
      isValidObjectId(id)
        ? await this.conversationModel
            .findOneAndUpdate({ _id: id, ownerId }, { title }, { new: true })
            .exec()
        : null,
    );
  }

  async remove(ownerId: string, id: string) {
    this.orNotFound(
      isValidObjectId(id)
        ? await this.conversationModel
            .findOneAndDelete({ _id: id, ownerId })
            .exec()
        : null,
    );
  }

  /**
   * Writes the turn. The chat route hands over the whole message list rather
   * than a delta — the AI SDK rebuilds a message as it streams (a tool call
   * gains its output, text parts grow), so "append" is not a thing that can be
   * expressed here. Trimming to the newest `MAX_CONVERSATION_MESSAGES` keeps
   * what is stored replayable by the next turn.
   */
  async replaceMessages(
    ownerId: string,
    id: string,
    messages: Record<string, unknown>[],
  ) {
    return this.orNotFound(
      isValidObjectId(id)
        ? await this.conversationModel
            .findOneAndUpdate(
              { _id: id, ownerId },
              { messages: messages.slice(-MAX_CONVERSATION_MESSAGES) },
              { new: true },
            )
            .exec()
        : null,
    );
  }

  private orNotFound(
    conversation: ConversationDocument | null,
  ): ConversationDocument {
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }
}
