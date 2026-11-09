/**
 * OpenAI achter dezelfde `AiProvider`-interface.
 *
 * Bewust `strict: false` op het json_schema: de strict-modus van OpenAI eist dat
 * élk veld in `required` staat, en onze criteria zijn juist grotendeels
 * optioneel ("ontbrekende criteria gewoon onbekend laten"). De echte garantie
 * komt hoe dan ook van de Zod-validatie hieronder, niet van de provider.
 */
import OpenAI from "openai";
import { z } from "zod";
import type { AiProvider, StructuredRequest, TextRequest } from "../../types/ai.js";
import { AiParseError, AiUnavailableError } from "../../lib/errors.js";
import { env } from "../../config/env.js";

export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string, client?: OpenAI) {
    this.model = model;
    this.client = client ?? new OpenAI({ apiKey, timeout: env.AI_TIMEOUT_MS });
  }

  async complete<T>(req: StructuredRequest<T>): Promise<T> {
    const jsonSchema = z.toJSONSchema(req.schema, { target: "draft-7", io: "input" });

    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: req.maxTokens ?? 4096,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: req.schemaName,
            strict: false,
            schema: jsonSchema as Record<string, unknown>,
          },
        },
      });
    } catch (e) {
      throw new AiUnavailableError(`OpenAI-aanroep mislukt: ${(e as Error).message}`);
    }

    const text = completion.choices[0]?.message.content;
    if (!text) {
      throw new AiParseError("Het model gaf geen tekstuele output terug");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new AiParseError("De output van het model was geen geldige JSON");
    }

    const result = req.schema.safeParse(req.normalize ? req.normalize(parsedJson) : parsedJson);
    if (!result.success) {
      throw new AiParseError("De output van het model voldeed niet aan het schema", {
        issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    return result.data;
  }

  async completeText(req: TextRequest): Promise<string> {
    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
      });
    } catch (e) {
      throw new AiUnavailableError(`OpenAI-aanroep mislukt: ${(e as Error).message}`);
    }
    return completion.choices[0]?.message.content?.trim() ?? "";
  }
}
