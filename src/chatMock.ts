import type { Request, Response } from "express";

const MOCK_SOURCES = [
  { title: "NEAR Protocol Overview", path: "docs/concepts/overview" },
  { title: "Smart Contracts in NEAR", path: "docs/contracts/introduction" },
  { title: "NEAR JavaScript SDK", path: "docs/sdk/js/introduction" },
];

const MOCK_RESPONSE = `NEAR Protocol is a layer-1 blockchain designed for usability and scalability.

**Key features:**
- Human-readable account names (e.g. \`alice.near\`)
- Sharded architecture (Nightshade)
- Low transaction fees (~$0.001)
- Supports smart contracts in Rust and JavaScript via the [NEAR SDK](docs/sdk/js/introduction)

\`\`\`bash
# Install NEAR CLI
npm install -g near-cli

# Create a testnet account
near create-account myapp.testnet --useFaucet
\`\`\`

See [NEAR Protocol Overview](docs/concepts/overview) for more details.`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sseChunk(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function chatMockHandler(req: Request, res: Response) {
  const { message } = req.body ?? {};

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Vercel-AI-UI-Message-Stream", "v1");
  res.setHeader("X-Accel-Buffering", "no");

  res.write(sseChunk({ type: "start", messageId: "mock-message-1" }));
  res.write(sseChunk({ type: "start-step" }));
  res.write(sseChunk({ type: "text-start", id: "text-1" }));

  const words = MOCK_RESPONSE.split(" ");
  for (const word of words) {
    res.write(sseChunk({ type: "text-delta", id: "text-1", delta: word + " " }));
    await sleep(30);
  }

  res.write(sseChunk({ type: "text-end", id: "text-1" }));
  res.write(sseChunk({ type: "finish-step" }));
  res.write(
    sseChunk({
      type: "finish",
      finishReason: "stop",
      messageMetadata: { sources: MOCK_SOURCES },
    })
  );
  res.write("data: [DONE]\n\n");
  res.end();
}
