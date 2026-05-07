import Plot from "react-plotly.js";

function SectionCard({ title, subtitle, children }) {
  // Bloc visuel reutilisable pour garder une UI homogene entre sections.
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_0_25px_rgba(15,23,42,0.35)]">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ChatHistorySection({ chatHistory }) {
  return (
    <SectionCard title="Historique rapide" subtitle="Derniers echanges utilisateur / agent">
      <div className="max-h-96 space-y-3 overflow-auto pr-1">
        {chatHistory.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
            Aucun echange pour le moment.
          </p>
        ) : (
          chatHistory.map((item, idx) => (
            <article key={`history-${idx}`} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-sm text-slate-100"><strong className="text-cyan-300">Q:</strong> {item.question}</p>
              <p className="text-sm text-slate-200"><strong className="text-emerald-300">R:</strong> {item.answer}</p>
              {item.error ? (
                <p className="text-sm text-rose-300"><strong>Erreur:</strong> {item.error}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </SectionCard>
  );
}

export function ThinkingSection({ thinking }) {
  return (
    <details open className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wider text-violet-200">
        Thinking
      </summary>
      <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
        {thinking || "Aucun thinking pour le moment."}
      </pre>
    </details>
  );
}

export function ToolCallsSection({ toolCalls }) {
  return (
    <SectionCard title="Tool Calls" subtitle="Invocations detectees pendant le run">
      <div className="max-h-96 space-y-3 overflow-auto pr-1">
        {toolCalls.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
            Pas de tool call.
          </p>
        ) : (
          toolCalls.map((call, idx) => (
            <article key={`${call.tool_name}-${idx}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <strong className="text-sm text-cyan-300">{call.tool_name}</strong>
              <pre className="mt-2 overflow-auto text-xs text-slate-300">{JSON.stringify(call.args, null, 2)}</pre>
            </article>
          ))
        )}
      </div>
    </SectionCard>
  );
}

export function ToolResultsSection({ toolResults }) {
  return (
    <SectionCard title="Tool Results" subtitle="Retours bruts des tools">
      <div className="max-h-96 space-y-3 overflow-auto pr-1">
        {toolResults.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
            Pas de resultat outil.
          </p>
        ) : (
          toolResults.map((res, idx) => (
            <article key={`${res.tool_name}-${idx}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <strong className="text-sm text-emerald-300">{res.tool_name}</strong>
              {res.truncated ? (
                <p className="mt-2 rounded border border-amber-700/70 bg-amber-950/30 px-2 py-1 text-xs text-amber-200">
                  Resultat tronque (limite backend a 2000 caracteres).
                </p>
              ) : null}
              <pre className="mt-2 overflow-auto text-xs text-slate-300">{res.content}</pre>
            </article>
          ))
        )}
      </div>
    </SectionCard>
  );
}

export function ArtifactsSection({ artifacts }) {
  return (
    <SectionCard title="Artefacts" subtitle="Graphiques et tableaux produits par les tools">
      <div className="space-y-4">
        {artifacts.length === 0 && (
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
            Aucun artefact.
          </p>
        )}
        {artifacts.map((artifact, idx) => {
          // Certains tools renvoient directement une figure Plotly serialisee.
          if (artifact.artifact_type === "figure_json" && artifact.figure) {
            return (
              <article key={`artifact-figure-${idx}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">{artifact.title || "Graphique"}</h3>
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
              <article key={`artifact-html-${idx}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">{artifact.title || "Figure"}</h3>
                <iframe
                  title={artifact.title || "figure"}
                  src={artifact.path}
                  className="min-h-[420px] w-full rounded-lg border border-slate-700"
                />
              </article>
            );
          }

          if (artifact.artifact_type === "table") {
            return (
              <article key={`artifact-table-${idx}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">{artifact.title || "Tableau"}</h3>
                {artifact.columns && artifact.rows ? (
                  // On affiche une preview compacte; le fichier complet reste dans output/.
                  <div className="overflow-auto">
                    <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        {artifact.columns.map((col) => (
                          <th key={col} className="border border-slate-700 px-2 py-1 text-left text-slate-300">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {artifact.rows.map((row, rowIndex) => (
                        <tr key={`${idx}-${rowIndex}`}>
                          {row.map((cell, colIndex) => (
                            <td key={`${idx}-${rowIndex}-${colIndex}`} className="border border-slate-800 px-2 py-1 text-slate-200">
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                ) : (
                  // Fallback si le backend n'a renvoye que le chemin du CSV.
                  <p className="text-sm text-slate-400">Tableau genere (voir output).</p>
                )}
              </article>
            );
          }

          // Si un nouveau type d'artefact arrive, on l'ignore sans casser l'UI.
          return null;
        })}
      </div>
    </SectionCard>
  );
}

export function FinalAnswerSection({ finalAnswer }) {
  return (
    <SectionCard title="Reponse finale" subtitle="Sortie agent nettoyee en fin de run">
      <p className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-relaxed text-slate-100">
        {finalAnswer || "En attente..."}
      </p>
    </SectionCard>
  );
}

export function ErrorSection({ error, onRetry, canRetry }) {
  if (!error) return null;

  return (
    <SectionCard title="Erreur run">
      <div className="space-y-3">
        <p className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={!canRetry}
          className="inline-flex items-center justify-center rounded-lg border border-rose-700 bg-rose-900/40 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-900/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reessayer la derniere question
        </button>
      </div>
    </SectionCard>
  );
}
