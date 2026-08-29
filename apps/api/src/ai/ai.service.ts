import { Injectable } from "@nestjs/common";
import {
  createGateway,
  wrapLanguageModel,
  type FinishReason,
  type LanguageModel,
  type LanguageModelMiddleware,
} from "ai";

/**
 * The gateway speaks the AI SDK's own gateway protocol, and the path pins the
 * SDK major it answers for — /v4/ai is AI SDK 7, so bumping the `ai` package
 * past 7 means bumping this with it. Overridable because it is self-hostable.
 * (Same wiring as vivace's coach: github.com/RATCHAW/vivace.)
 */
const DEFAULT_GATEWAY_URL = "https://api.llmgateway.io/v4/ai";

/**
 * Model ids are written vendor/model so the vendor is pinned — the gateway
 * routes to whichever provider serves it.
 */
const DEFAULT_CHAT_MODEL = "deepseek/deepseek-v4-flash";

/**
 * Owns the model configuration for every AI feature. Every model is reached
 * through LLM Gateway (https://llmgateway.io), so swapping models is an env
 * change (`AI_CHAT_MODEL`), never a dependency change.
 */
@Injectable()
export class AiService {
  /** Whether chat can work at all; the chat route turns this into a 503. */
  isReady(): boolean {
    return Boolean(process.env.LLM_GATEWAY_API_KEY);
  }

  chatModel(): LanguageModel {
    const gateway = createGateway({
      apiKey: process.env.LLM_GATEWAY_API_KEY,
      baseURL: process.env.LLM_GATEWAY_URL || DEFAULT_GATEWAY_URL,
    });
    return wrapLanguageModel({
      model: gateway(process.env.AI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL),
      middleware: unifiedFinishReason,
    });
  }
}

/** The v4 provider spec's finish reason: a unified value plus the raw one. */
type FinishReasonV4 = { unified: FinishReason; raw: string | undefined };

const UNIFIED_FINISH_REASONS: readonly string[] = [
  "stop",
  "length",
  "content-filter",
  "tool-calls",
  "error",
  "other",
];

/**
 * Repairs a v3-shaped finish reason coming back from the gateway.
 *
 * LLM Gateway's /v4/ai endpoint has only partly moved to the v4 provider
 * spec: usage arrives in the new nested shape, but `finishReason` is still
 * the bare string v3 sent (`"tool-calls"`) rather than v4's
 * `{ unified, raw }`. That difference is silent and expensive — the SDK gates
 * tool execution on `finishReason.unified` being `"stop"` or `"tool-calls"`
 * (`isToolExecutionAllowedFinishReason`), so an `undefined` there means tool
 * calls stream to the client and then simply never run: no tool result, no
 * second step, and a chat panel stuck on "Creating a mindmap" forever.
 *
 * Normalizing it here keeps the repair at the model boundary, where the
 * protocol mismatch actually is. It is a no-op once the gateway sends the v4
 * shape, so it can stay until then and be deleted without ceremony.
 */
export const unifiedFinishReason: LanguageModelMiddleware = {
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();
    return { ...result, finishReason: normalize(result.finishReason) };
  },
  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream();
    return {
      ...rest,
      stream: stream.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(
              chunk.type === "finish"
                ? { ...chunk, finishReason: normalize(chunk.finishReason) }
                : chunk,
            );
          },
        }),
      ),
    };
  },
};

function normalize(finishReason: FinishReasonV4): FinishReasonV4 {
  // Typed as the v4 object, but the gateway is what actually decides.
  const raw = finishReason as FinishReasonV4 | string | undefined;
  if (typeof raw !== "string") return finishReason;
  return {
    unified: UNIFIED_FINISH_REASONS.includes(raw)
      ? (raw as FinishReason)
      : "other",
    raw,
  };
}
