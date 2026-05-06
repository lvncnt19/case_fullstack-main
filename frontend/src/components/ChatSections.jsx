import Plot from "react-plotly.js";

export function ChatHistorySection({ chatHistory }) {
  return (
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
  );
}

export function ThinkingSection({ thinking }) {
  return (
    <details open>
      <summary>Thinking</summary>
      <pre className="panel">{thinking || "Aucun thinking pour le moment."}</pre>
    </details>
  );
}

export function ToolCallsSection({ toolCalls }) {
  return (
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
  );
}

export function ToolResultsSection({ toolResults }) {
  return (
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
  );
}

export function ArtifactsSection({ artifacts }) {
  return (
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
  );
}

export function FinalAnswerSection({ finalAnswer }) {
  return (
    <section>
      <h2>Reponse finale</h2>
      <p className="panel">{finalAnswer || "En attente..."}</p>
    </section>
  );
}

export function ErrorSection({ error }) {
  if (!error) return null;

  return (
    <section>
      <h2>Erreur</h2>
      <p className="panel error">{error}</p>
    </section>
  );
}
