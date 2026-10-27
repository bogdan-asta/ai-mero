import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function createOpenRouterModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const primaryModel = process.env.OPENROUTER_CHAT_MODEL;
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL;

  if (!apiKey) {
    throw new Error("OpenRouter is not configured. Set OPENROUTER_API_KEY.");
  }

  if (!primaryModel) {
    throw new Error("OpenRouter is not configured. Set OPENROUTER_CHAT_MODEL.");
  }

  const provider = createOpenRouter({ apiKey });
  const models = [
    primaryModel,
    ...(fallbackModel && fallbackModel !== primaryModel ? [fallbackModel] : []),
  ];

  return {
    model: provider.chat(primaryModel, {
      extraBody: { models },
    }),
    modelId: primaryModel,
  };
}
