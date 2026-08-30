import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { AiModule } from "./ai/ai.module";
import { auth } from "./auth";
import { ConversationsModule } from "./conversations/conversations.module";
import { HealthController } from "./health/health.controller";
import { McpModule } from "./mcp/mcp.module";
import { MeModule } from "./me/me.module";
import { MindmapsModule } from "./mindmaps/mindmaps.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? "mongodb://localhost:27017/thinkclear",
    ),
    AuthModule.forRoot({ auth }),
    MindmapsModule,
    ConversationsModule,
    AiModule,
    McpModule,
    MeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
