import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Mindmap, MindmapSchema } from "./mindmap.schema";
import { MindmapsController } from "./mindmaps.controller";
import { MindmapsService } from "./mindmaps.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Mindmap.name, schema: MindmapSchema }]),
  ],
  controllers: [MindmapsController],
  providers: [MindmapsService],
})
export class MindmapsModule {}
