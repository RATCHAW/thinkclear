import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EventsModule } from "../events/events.module";
import { Mindmap, MindmapSchema } from "./mindmap.schema";
import { MindmapsController } from "./mindmaps.controller";
import { MindmapsService } from "./mindmaps.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Mindmap.name, schema: MindmapSchema }]),
    EventsModule,
  ],
  controllers: [MindmapsController],
  providers: [MindmapsService],
  exports: [MindmapsService],
})
export class MindmapsModule {}
