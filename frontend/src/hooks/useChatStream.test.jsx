import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStream } from "./useChatStream";

const parseSseChunksMock = vi.fn();

vi.mock("../lib/sse", () => ({
  parseSseChunks: (...args) => parseSseChunksMock(...args)
}));

describe("useChatStream", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends question and updates states from streamed events", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({})
      }
    });

    parseSseChunksMock.mockImplementation(async (_reader, onEvent) => {
      onEvent("session", { session_id: "session-1" });
      onEvent("thinking_delta", { delta: "Analyzing..." });
      onEvent("tool_call", { tool_name: "query_data", args: { sql: "select 1" } });
      onEvent("tool_result", { tool_name: "query_data", content: "ok" });
      onEvent("artifact", { artifact_type: "table", columns: ["a"], rows: [[1]] });
      onEvent("final", { text: "Done" });
      onEvent("done", {});
    });

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.ask("  Hello data  ");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat/stream",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          question: "Hello data",
          session_id: null
        })
      })
    );
    expect(result.current.thinking).toBe("Analyzing...");
    expect(result.current.toolCalls).toHaveLength(1);
    expect(result.current.toolResults).toHaveLength(1);
    expect(result.current.artifacts).toHaveLength(1);
    expect(result.current.finalAnswer).toBe("Done");
    expect(result.current.chatHistory).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it("stores error when streaming API is unavailable", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      body: null
    });

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.ask("question");
    });

    expect(result.current.error).toBe("Streaming API unavailable");
    expect(result.current.loading).toBe(false);
  });
});
