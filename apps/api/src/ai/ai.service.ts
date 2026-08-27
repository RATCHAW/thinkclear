import { Injectable } from "@nestjs/common";
import { generateText } from "ai";

// Placeholder proving the Vercel AI SDK is wired into the API build.
// Real AI features (model providers, streaming, tools) come later.
@Injectable()
export class AiService {
  isReady(): boolean {
    return typeof generateText === "function";
  }
}
