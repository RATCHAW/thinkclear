import { Module } from "@nestjs/common";
import { MindmapsModule } from "../mindmaps/mindmaps.module";
import { AiService } from "./ai.service";
import { ChatController } from "./chat.controller";
import { MindmapToolsService } from "./mindmap-tools.service";

@Module({
  imports: [MindmapsModule],
  controllers: [ChatController],
  providers: [AiService, MindmapToolsService],
})
export class AiModule {}
