import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { zodResponseFormat } from "openai/helpers/zod";
import { ZodSchema } from 'zod';
import { z } from 'zod';
import { FileCache } from './cache';
import { ChatCompletionTool } from 'openai/resources/index.mjs';

let _openai: OpenAI | undefined;
let _anthropic: Anthropic | undefined;

function getOpenAIClient() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

function getAnthropicClient() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropic;
}

// Initialize cache with a one year expiration
const cache = new FileCache('.cache/ai', 365 * 24 * 60 * 60 * 1000);

export async function generatePlainText(
  {
    provider,
    model,
    system,
    prompt,
    forceRefresh = false,
    temperature = 0
  }: {
    provider: 'openai' | 'anthropic';
    model: string;
    system: string;
    prompt: string;
    forceRefresh?: boolean;
    temperature?: number;
  }): Promise<string> {
  const cacheKey = {
    type: 'completion',
    provider,
    model,
    system,
    prompt,
  };

  // Try to get from cache first
  if (!forceRefresh) {
    const cachedResult = await cache.get<string>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  let result: string;
  if (provider === 'openai') {
    const resp = await getOpenAIClient().chat.completions.create({
      model,
      temperature,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    });

    result = resp.choices[0].message.content || '';
  } else if (provider === 'anthropic') {
    throw new Error('Anthropic is not supported yet');
  } else {
    throw new Error('Invalid provider');
  }

  // Cache the result
  await cache.set(cacheKey, result);
  return result;
}

export async function generateStructuredOutput<T extends ZodSchema>(
  {
    provider,
    model,
    system,
    prompt,
    schema,
    schemaName = "output",
    forceRefresh = false,
    temperature = 0
  }: {
    provider: 'openai' | 'anthropic';
    model: string;
    system: string;
    prompt: string;
    schema: T;
    schemaName: string;
    forceRefresh?: boolean;
    temperature?: number;
  }): Promise<z.infer<T>> {
  const cacheKey = {
    type: 'completion',
    provider,
    model,
    system,
    prompt,
    schema: schema.toString(),
    schemaName,
    // Don't track temperature in cache key
  };

  // Try to get from cache first
  if (!forceRefresh) {
    const cachedResult = await cache.get<z.infer<T>>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  let result: z.infer<T>;
  if (provider === 'openai') {
    const resp = await getOpenAIClient().beta.chat.completions.parse({
      model,
      temperature,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      response_format: zodResponseFormat(schema, schemaName),
    });

    result = resp.choices[0].message.parsed;
  } else if (provider === 'anthropic') {
    throw new Error('Anthropic is not supported yet');
  } else {
    throw new Error('Invalid provider');
  }

  // Cache the result
  await cache.set(cacheKey, result);
  return result;
}

export async function generateFunctionOutput(
  {
    provider,
    model,
    system,
    history,
    prompt,
    tools,
    forceRefresh = false,
    temperature = 0
  }: {
    provider: 'openai' | 'anthropic';
    model: string;
    system: string;
    history?: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    prompt: string;
    tools: ChatCompletionTool[];
    forceRefresh?: boolean;
    temperature?: number;
  }): Promise<{ result: OpenAI.Chat.Completions.ChatCompletionMessage, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] }> {
  const cacheKey = {
    type: 'completion',
    provider,
    model,
    history: JSON.stringify(history),
    system,
    prompt,
    functions: JSON.stringify(tools),
  };

  // Try to get from cache first
  if (!forceRefresh) {
    const cachedResult = await cache.get<{ result: OpenAI.Chat.Completions.ChatCompletionMessage, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] }>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  if (provider === 'openai') {
    const resp = await getOpenAIClient().chat.completions.create({
      model,
      temperature,
      messages: [{ role: "system", content: system }, ...(history || []), { role: "user", content: prompt }],
      tools: tools,
      tool_choice: "required"
    });

    const messageStack: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...(history || []),
      { role: "user", content: prompt },
      { role: "assistant", content: `${resp.choices[0].message.tool_calls?.[0]?.function?.name}: ${JSON.stringify(resp.choices[0].message?.tool_calls?.[0]?.function?.arguments, null, 2)}` }
    ];

    const result = resp.choices[0].message;

    const answer = {
      result, messages: messageStack
    }
    // Cache the result
    await cache.set(cacheKey, answer);
    return answer;
  } else if (provider === 'anthropic') {
    throw new Error('Anthropic is not supported yet');
  } else {
    throw new Error('Invalid provider');
  }
}

export async function batchedGetOpenAIEmbedding(texts: string[], batchSize: number = 10): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map(async (text) => {
      return getOpenAIEmbedding(text);
    }));
    results.push(...embeddings);
  }
  return results;
}

export async function getOpenAIEmbedding(text: string): Promise<number[]> {
  const model = "text-embedding-3-small";
  const cacheKey = {
    type: 'embedding',
    model,
    text,
  };

  // Try to get from cache first
  const cachedResult = await cache.get<number[]>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // TODO Preprocess text
  const result = (
    await getOpenAIClient().embeddings.create({
      model,
      input: text,
    })
  ).data[0].embedding;

  // Cache the result
  await cache.set(cacheKey, result);
  return result;
}
