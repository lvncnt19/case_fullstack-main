import { useState } from "react";
import { parseSseChunks } from "../lib/sse";

const EMPTY_STATE = {
  thinking: "",
  toolCalls: [],
  toolResults: [],
  artifacts: [],
  finalAnswer: "",
  error: ""
};

export function useChatStream() {
  const [runStatus, setRunStatus] = useState("idle");
  const [sessionId, setSessionId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [thinking, setThinking] = useState(EMPTY_STATE.thinking);
  const [toolCalls, setToolCalls] = useState(EMPTY_STATE.toolCalls);
  const [toolResults, setToolResults] = useState(EMPTY_STATE.toolResults);
  const [artifacts, setArtifacts] = useState(EMPTY_STATE.artifacts);
  const [finalAnswer, setFinalAnswer] = useState(EMPTY_STATE.finalAnswer);
  const [error, setError] = useState(EMPTY_STATE.error);
  const [loading, setLoading] = useState(false);

  const resetCurrentRun = () => {
    setThinking(EMPTY_STATE.thinking);
    setToolCalls(EMPTY_STATE.toolCalls);
    setToolResults(EMPTY_STATE.toolResults);
    setArtifacts(EMPTY_STATE.artifacts);
    setFinalAnswer(EMPTY_STATE.finalAnswer);
    setError(EMPTY_STATE.error);
  };

  const ask = async (question) => {
    if (!question.trim() || loading) return;

    const askedQuestion = question.trim();
    let streamedAnswer = "";
    let streamedError = "";
    resetCurrentRun();
    setRunStatus("streaming");
    setLoading(true);

    try {
      // Le backend stream en SSE: on traite chaque evenement des reception.
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: askedQuestion,
          session_id: sessionId
        })
      });

      if (!response.ok || !response.body) {
        throw new Error("Streaming API unavailable");
      }

      const reader = response.body.getReader();
      await parseSseChunks(reader, (eventType, payload) => {
        if (eventType === "session") {
          if (payload.session_id) setSessionId(payload.session_id);
          setRunStatus("streaming");
          return;
        }
        if (eventType === "thinking_delta") {
          setThinking((prev) => prev + (payload.delta || ""));
          setRunStatus("streaming");
          return;
        }
        if (eventType === "tool_call") {
          setToolCalls((prev) => [...prev, payload]);
          setRunStatus("tool_running");
          return;
        }
        if (eventType === "tool_result") {
          setToolResults((prev) => [...prev, payload]);
          setRunStatus("streaming");
          return;
        }
        if (eventType === "artifact") {
          setArtifacts((prev) => [...prev, payload]);
          setRunStatus("streaming");
          return;
        }
        if (eventType === "final") {
          streamedAnswer = payload.text || "";
          setFinalAnswer(streamedAnswer);
          setRunStatus("streaming");
          return;
        }
        if (eventType === "error") {
          streamedError = payload.message || "Unknown backend error";
          setError(streamedError);
          setRunStatus("error");
          return;
        }
        if (eventType === "done") {
          // On fige l'echange courant dans l'historique une fois le run termine.
          setChatHistory((prev) => [
            ...prev,
            {
              question: askedQuestion,
              answer: streamedAnswer || "(aucune reponse)",
              error: streamedError || ""
            }
          ]);
          if (!streamedError) setRunStatus("done");
        }
      });
    } catch (err) {
      setError(err.message);
      setRunStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return {
    ask,
    loading,
    runStatus,
    chatHistory,
    thinking,
    toolCalls,
    toolResults,
    artifacts,
    finalAnswer,
    error
  };
}
