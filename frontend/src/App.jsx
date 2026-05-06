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
    loading,
    chatHistory,
    thinking,
    toolCalls,
    toolResults,
    artifacts,
    finalAnswer,
    error
  } = useChatStream();

  return (
    <main className="page">
      <h1>Case Fullstack - MVP Streaming</h1>
      <ChatForm onAsk={ask} loading={loading} />
      <ChatHistorySection chatHistory={chatHistory} />
      <ThinkingSection thinking={thinking} />
      <ToolCallsSection toolCalls={toolCalls} />
      <ToolResultsSection toolResults={toolResults} />
      <ArtifactsSection artifacts={artifacts} />
      <FinalAnswerSection finalAnswer={finalAnswer} />
      <ErrorSection error={error} />
    </main>
  );
}
