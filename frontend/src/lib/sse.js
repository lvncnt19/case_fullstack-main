export async function parseSseChunks(reader, onEvent) {
  const decoder = new TextDecoder();
  let buffer = "";

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
}
