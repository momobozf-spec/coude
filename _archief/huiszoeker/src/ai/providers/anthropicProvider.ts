/**
 * Anthropic achter de `AiProvider`-interface.
 *
 * De modelnaam komt uit `env.ANTHROPIC_MODEL` en staat nergens anders in de
 * codebase. Structured output gebeurt met `output_config.format`, gevoed door
 * het JSON-schema dat uit hetzelfde Zod-schema komt waarmee we het antwoord
 * daarna valideren — het model krijgt dus letterlijk het contract waarop het
 * afgerekend wordt.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AiProvider, StructuredRequest, TextRequest } from "../../types/ai.js";
import { AiParseError, AiUnavailableError } from "../../lib/errors.js";
import { env } from "../../config/env.js";

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string, client?: Anthropic) {
    this.model = model;
    this.client = client ?? new Anthropic({ apiKey, timeout: env.AI_TIMEOUT_MS });
  }

  async complete<T>(req: StructuredRequest<T>): Promise<T> {
    const jsonSchema = z.toJSONSchema(req.schema, { target: "draft-7", io: "input" });

    let response;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 4096,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: jsonSchema as Record<string, unknown>,
          },
        },
      });
    } catch (e) {
      throw new AiUnavailableError(`Anthropic-aanroep mislukt: ${(e as Error).message}`);
    }

    if (response.stop_reason === "refusal") {
      throw new AiUnavailableError("Het model weigerde deze aanvraag te beantwoorden");
    }

    const text = firstTextBlock(response.content);
    if (text === undefined) {
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
    let response;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 1024,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: { effort: "low" },
      });
    } catch (e) {
      throw new AiUnavailableError(`Anthropic-aanroep mislukt: ${(e as Error).message}`);
    }

    if (response.stop_reason === "refusal") {
      throw new AiUnavailableError("Het model weigerde deze aanvraag te beantwoorden");
    }

    return firstTextBlock(response.content)?.trim() ?? "";
  }
}

function firstTextBlock(content: Anthropic.ContentBlock[]): string | undefined {
  for (const block of content) {
    if (block.type === "text") return block.text;
  }
  return undefined;
}
