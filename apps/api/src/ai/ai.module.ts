import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { MindmapsModule } from "../mindmaps/mindmaps.module";
import { AiService } from "./ai.service";
import { ChatController } from "./chat.controller";
import { MindmapToolsService } from "./mindmap-tools.service";

@Module({
  imports: [MindmapsModule, ConversationsModule],
  controllers: [ChatController],
  providers: [AiService, MindmapToolsService],
  // The MCP server serves the same tools to outside agent clients.
  exports: [MindmapToolsService],
})
export class AiModule {}
