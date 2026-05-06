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
    <form onSubmit={handleSubmit} className="ask-form">
      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Posez votre question data..."
        rows={3}
      />
      <div className="controls">
        <button type="submit" disabled={loading}>
          {loading ? "Streaming..." : "Envoyer"}
        </button>
      </div>
    </form>
  );
}
