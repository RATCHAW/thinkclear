import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { AiService } from "./ai/ai.service";
import { auth } from "./auth";
import { MeController } from "./me/me.controller";
import { MindmapsModule } from "./mindmaps/mindmaps.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? "mongodb://localhost:27017/mindmap",
    ),
    AuthModule.forRoot({ auth }),
    MindmapsModule,
  ],
  controllers: [MeController],
  providers: [AiService],
})
export class AppModule {}
