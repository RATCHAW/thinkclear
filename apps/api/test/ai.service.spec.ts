import { describe, expect, it, vi } from "vitest";
import {
  generateText,
  isStepCount,
  streamText,
  tool,
  wrapLanguageModel,
} from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { unifiedFinishReason } from "../src/ai/ai.service";

/**
 * LLM Gateway's /v4/ai endpoint answers with a v3-shaped `finishReason` — the
 * bare string, not v4's `{ unified, raw }`. The SDK gates tool execution on
 * `finishReason.unified`, so without the middleware a tool call streams to the
 * client and then never runs: the chat panel hangs on "Creating a mindmap".
 * These tests pin the repair by asserting the tool actually executes.
 */
const legacyFinishReason = "tool-calls" as unknown as {
  unified: "tool-calls";
  raw: undefined;
};

const toolCall = {
  type: "tool-call" as const,
  toolCallId: "call-1",
  toolName: "add",
  input: JSON.stringify({ a: 41, b: 1 }),
};

const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

function addTool(execute: (input: { a: number; b: number }) => unknown) {
  return {
    add: tool({
      description: "Add two numbers",
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => execute({ a, b }),
    }),
  };
}

describe("unifiedFinishReason", () => {
  it("runs tool calls when the gateway sends a bare-string finish reason", async () => {
    const execute = vi.fn(({ a, b }: { a: number; b: number }) => ({
      sum: a + b,
    }));
    let call = 0;
    const model = wrapLanguageModel({
      model: new MockLanguageModelV4({
        doGenerate: async () => ({
          content:
            call++ === 0 ? [toolCall] : [{ type: "text", text: "It is 42." }],
          finishReason: legacyFinishReason,
          usage,
          warnings: [],
        }),
      }),
      middleware: unifiedFinishReason,
    });

    const result = await generateText({
      model,
      prompt: "What is 41 + 1?",
      tools: addTool(execute),
      stopWhen: isStepCount(3),
    });

    expect(execute).toHaveBeenCalledWith({ a: 41, b: 1 });
    expect(result.toolResults.map((r) => r.output)).toEqual([{ sum: 42 }]);
    expect(result.text).toBe("It is 42.");
  });

  it("runs tool calls on the streaming path too", async () => {
    const execute = vi.fn(({ a, b }: { a: number; b: number }) => ({
      sum: a + b,
    }));
    const model = wrapLanguageModel({
      model: new MockLanguageModelV4({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: "stream-start", warnings: [] },
            { ...toolCall, input: toolCall.input },
            { type: "finish", finishReason: legacyFinishReason, usage },
          ]),
        }),
      }),
      middleware: unifiedFinishReason,
    });

    const result = streamText({
      model,
      prompt: "What is 41 + 1?",
      tools: addTool(execute),
      // One step: the assertion is that the tool ran, not that the loop
      // continued — a second step would need a second mocked response.
      stopWhen: isStepCount(1),
    });
    await result.consumeStream();

    expect(execute).toHaveBeenCalledWith({ a: 41, b: 1 });
    expect((await result.toolResults).map((r) => r.output)).toEqual([
      { sum: 42 },
    ]);
  });

  it("leaves an already-unified finish reason untouched", async () => {
    const model = wrapLanguageModel({
      model: new MockLanguageModelV4({
        doGenerate: async () => ({
          content: [{ type: "text", text: "hi" }],
          finishReason: { unified: "stop", raw: "end_turn" },
          usage,
          warnings: [],
        }),
      }),
      middleware: unifiedFinishReason,
    });

    const result = await generateText({ model, prompt: "hi" });

    expect(result.finishReason).toBe("stop");
  });
});
