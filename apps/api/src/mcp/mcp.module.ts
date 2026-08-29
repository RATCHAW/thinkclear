import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";
import { OAuthDiscoveryController } from "./oauth-discovery.controller";

/**
 * The MCP server, and the OAuth discovery routes that let a client find its
 * way to it. It imports `AiModule` for `MindmapToolsService` alone: the tools
 * an outside agent gets are the same objects the chat panel calls, not a
 * parallel implementation.
 */
@Module({
  imports: [AiModule],
  controllers: [McpController, OAuthDiscoveryController],
  providers: [McpService],
})
export class McpModule {}
