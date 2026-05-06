import { useState } from "react";

export default function ChatForm({ onAsk, loading }) {
  const [question, setQuestion] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const askedQuestion = question.trim();
    if (!askedQuestion || loading) return;
    setQuestion("");
    await onAsk(askedQuestion);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_0_30px_rgba(15,23,42,0.4)]"
    >
      <label className="mb-2 block text-sm font-medium text-slate-300">Ta question</label>
      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Posez votre question data..."
        rows={3}
        className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">Astuce: demande un tableau puis un graphique pour tester les tools.</p>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-w-28 items-center justify-center rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Streaming..." : "Envoyer"}
        </button>
      </div>
    </form>
  );
}
