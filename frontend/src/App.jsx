import ChatForm from "./components/ChatForm";
import {
  ArtifactsSection,
  ChatHistorySection,
  ErrorSection,
  FinalAnswerSection,
  ThinkingSection,
  ToolCallsSection,
  ToolResultsSection
} from "./components/ChatSections";
import { useChatStream } from "./hooks/useChatStream";

export default function App() {
  const {
    ask,
    retryLastQuestion,
    canRetry,
    loading,
    runStatus,
    chatHistory,
    thinking,
    toolCalls,
    toolResults,
    artifacts,
    finalAnswer,
    error
  } = useChatStream();

  const statusStyles = {
    idle: "border-slate-700 bg-slate-800 text-slate-200",
    streaming: "border-cyan-500/60 bg-cyan-500/15 text-cyan-200",
    tool_running: "border-violet-500/60 bg-violet-500/15 text-violet-200",
    done: "border-emerald-500/60 bg-emerald-500/15 text-emerald-200",
    error: "border-rose-500/60 bg-rose-500/15 text-rose-200"
  };

  const statusLabel = {
    idle: "Idle",
    streaming: "Streaming",
    tool_running: "Tool Running",
    done: "Done",
    error: "Error"
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <header className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-6 shadow-[0_0_30px_rgba(6,182,212,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">AI Agent Console</p>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[runStatus]}`}
            >
              {statusLabel[runStatus]}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Case Fullstack</h1>
          <p className="mt-2 text-sm text-slate-300">
            Pose une question, observe le raisonnement, les outils appelés et les artefacts en temps reel.
          </p>
        </header>

        <ChatForm onAsk={ask} loading={loading} />

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <FinalAnswerSection finalAnswer={finalAnswer} />
            <ArtifactsSection artifacts={artifacts} />
            <ErrorSection error={error} onRetry={retryLastQuestion} canRetry={canRetry} />
          </div>
          <div className="space-y-6">
            <ThinkingSection thinking={thinking} />
            <ToolCallsSection toolCalls={toolCalls} />
            <ToolResultsSection toolResults={toolResults} />
          </div>
        </section>

        <ChatHistorySection chatHistory={chatHistory} />
      </div>
    </main>
  );
}
