const DEFAULT_MODEL = "openai/gpt-4o-mini";

export function openRouterModel(): string {
  const env =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {};
  return env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

export async function chatCompletion(args: {
  apiKey: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<{ content: string; model: string }> {
  const model = openRouterModel();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://alphatest.ai",
      "X-Title": "AlphaTest AI",
    },
    body: JSON.stringify({
      model,
      temperature: args.temperature ?? 0.3,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `OpenRouter HTTP ${res.status}: ${body.slice(0, 400)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }
  return { content, model: data.model ?? model };
}

export function parseJsonObject(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model did not return valid JSON.");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}
