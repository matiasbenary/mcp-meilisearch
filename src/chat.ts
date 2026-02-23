import type { Request, Response } from "express";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { searchNearDocs, type SearchResult } from "./searchClient.js";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You answer questions about NEAR Protocol using ONLY the provided <search_results>.

Rules:
- Use ONLY information from <search_results>. NEVER invent APIs, methods, or code not present in the docs.
- If the docs don't cover the topic, you might need to search with different keywords.
- If after three attempts you can't find relevant info, say "I couldn't find an answer in the docs."
- Answer in the user's language. Use Markdown with code blocks, headings, and bold for key terms.
- Keep answers concise. Include code examples from the docs when relevant.
- NEVER answer questions outside the topics covered by NEAR Docs.
- Include inline references to the docs in your answer when relevant, using the format [title](path).`;

function buildSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return "<search_results>No results found.</search_results>";
  const docs = results
    .map((r, i) => `<doc title="${r.title}" path="${r.path}">\n${r.content}\n</doc>`)
    .join("\n");
  return `<search_results>\n${docs}\n</search_results>`;
}

export async function chatHandler(req: Request, res: Response) {
  try {
    const { message, history = [] }: { message: string; history: HistoryMessage[] } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Always search docs first — no tool-calling overhead
    const searchResults = await searchNearDocs(message);
    const searchContext = buildSearchContext(searchResults);

    const result = streamText({
      model: anthropic("claude-haiku-4-5"),
      system: SYSTEM_PROMPT,
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: `${searchContext}\n\n${message}` },
      ],
      temperature: 0,
      maxOutputTokens: 1024,
    });

    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`);
    }

    await result.text;

    const sources = searchResults
      .filter((r) => r.path)
      .map((r) => ({ title: r.title, path: r.path }));

    res.write(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat error:", error);
    res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to process chat request" })}\n\n`);
    res.end();
  }
}
