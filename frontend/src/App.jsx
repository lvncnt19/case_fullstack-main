import { useState } from "react";
import Plot from "react-plotly.js";

function parseSseChunks(reader, onEvent) {
  const decoder = new TextDecoder();
  let buffer = "";

  const readLoop = async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const rawEvent of events) {
        const lines = rawEvent.split("\n");
        let eventType = "message";
        const dataLines = [];

        for (const line of lines) {
          if (line.startsWith("event:")) eventType = line.slice(6).trim();
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }

        if (!dataLines.length) continue;
        try {
          onEvent(eventType, JSON.parse(dataLines.join("\n")));
        } catch (_error) {
          // Ignore malformed chunks to keep the UI resilient.
        }
      }
    }
  };

  return readLoop();
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [thinking, setThinking] = useState("");
  const [toolCalls, setToolCalls] = useState([]);
  const [toolResults, setToolResults] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetConversationState = () => {
    setThinking("");
    setToolCalls([]);
    setToolResults([]);
    setArtifacts([]);
    setFinalAnswer("");
    setError("");
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    const askedQuestion = question.trim();
    let streamedAnswer = "";
    let streamedError = "";
    setQuestion("");

    resetConversationState();
    setLoading(true);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
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
          return;
        }
        if (eventType === "thinking_delta") {
          setThinking((prev) => prev + (payload.delta || ""));
          return;
        }
        if (eventType === "tool_call") {
          setToolCalls((prev) => [...prev, payload]);
          return;
        }
        if (eventType === "tool_result") {
          setToolResults((prev) => [...prev, payload]);
          return;
        }
        if (eventType === "artifact") {
          setArtifacts((prev) => [...prev, payload]);
          return;
        }
        if (eventType === "final") {
          streamedAnswer = payload.text || "";
          setFinalAnswer(streamedAnswer);
          return;
        }
        if (eventType === "error") {
          streamedError = payload.message || "Unknown backend error";
          setError(streamedError);
          return;
        }
        if (eventType === "done") {
          setChatHistory((prev) => [
            ...prev,
            {
              question: askedQuestion,
              answer: streamedAnswer || "(aucune reponse)",
              error: streamedError || ""
            }
          ]);
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <h1>Case Fullstack - MVP Streaming</h1>

      <form onSubmit={handleAsk} className="ask-form">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Posez votre question data..."
          rows={3}
        />
        <div className="controls">
          <button type="submit" disabled={loading}>
            {loading ? "Streaming..." : "Envoyer"}
          </button>
        </div>
      </form>

      <section>
        <h2>Historique rapide</h2>
        <div className="panel">
          {chatHistory.length === 0 ? (
            <p>Aucun echange pour le moment.</p>
          ) : (
            chatHistory.map((item, idx) => (
              <article key={`history-${idx}`} className="card">
                <p><strong>Q:</strong> {item.question}</p>
                <p><strong>R:</strong> {item.answer}</p>
                {item.error ? <p className="error"><strong>Erreur:</strong> {item.error}</p> : null}
              </article>
            ))
          )}
        </div>
      </section>

      <details open>
        <summary>Thinking</summary>
        <pre className="panel">{thinking || "Aucun thinking pour le moment."}</pre>
      </details>

      <section>
        <h2>Tool Calls</h2>
        <div className="panel">
          {toolCalls.length === 0 ? (
            <p>Pas de tool call.</p>
          ) : (
            toolCalls.map((call, idx) => (
              <article key={`${call.tool_name}-${idx}`} className="card">
                <strong>{call.tool_name}</strong>
                <pre>{JSON.stringify(call.args, null, 2)}</pre>
              </article>
            ))
          )}
        </div>
      </section>

      <section>
        <h2>Tool Results</h2>
        <div className="panel">
          {toolResults.length === 0 ? (
            <p>Pas de resultat outil.</p>
          ) : (
            toolResults.map((res, idx) => (
              <article key={`${res.tool_name}-${idx}`} className="card">
                <strong>{res.tool_name}</strong>
                <pre>{res.content}</pre>
              </article>
            ))
          )}
        </div>
      </section>

      <section>
        <h2>Artefacts</h2>
        <div className="panel">
          {artifacts.length === 0 && <p>Aucun artefact.</p>}
          {artifacts.map((artifact, idx) => {
            if (artifact.artifact_type === "figure_json" && artifact.figure) {
              return (
                <article key={`artifact-figure-${idx}`} className="card">
                  <h3>{artifact.title || "Graphique"}</h3>
                  <Plot
                    data={artifact.figure.data || []}
                    layout={{ ...artifact.figure.layout, autosize: true }}
                    style={{ width: "100%", height: "100%" }}
                  />
                </article>
              );
            }

            if (artifact.artifact_type === "figure" && artifact.path) {
              return (
                <article key={`artifact-html-${idx}`} className="card">
                  <h3>{artifact.title || "Figure"}</h3>
                  <iframe title={artifact.title || "figure"} src={artifact.path} className="figure-frame" />
                </article>
              );
            }

            if (artifact.artifact_type === "table") {
              return (
                <article key={`artifact-table-${idx}`} className="card">
                  <h3>{artifact.title || "Tableau"}</h3>
                  {artifact.columns && artifact.rows ? (
                    <table>
                      <thead>
                        <tr>
                          {artifact.columns.map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {artifact.rows.map((row, rowIndex) => (
                          <tr key={`${idx}-${rowIndex}`}>
                            {row.map((cell, colIndex) => (
                              <td key={`${idx}-${rowIndex}-${colIndex}`}>{String(cell)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>Tableau genere (voir output).</p>
                  )}
                </article>
              );
            }

            return null;
          })}
        </div>
      </section>

      <section>
        <h2>Reponse finale</h2>
        <p className="panel">{finalAnswer || "En attente..."}</p>
      </section>

      {error && (
        <section>
          <h2>Erreur</h2>
          <p className="panel error">{error}</p>
        </section>
      )}
    </main>
  );
}
