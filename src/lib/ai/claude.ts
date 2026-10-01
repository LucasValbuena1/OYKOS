// Cliente de Claude (Anthropic) — SOLO servidor. La API key nunca llega al
// navegador: los Client Components llaman a /api/ai/* y estas rutas llaman a
// Claude. Se usan "structured outputs" (output_config.format con JSON Schema)
// para que la respuesta siempre sea JSON con un esquema fijo.
import Anthropic from "@anthropic-ai/sdk";
import type {
  AssistantFacts,
  ConsumptionProfile,
} from "@/lib/domain/assistant";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export const isClaudeConfigured = (
  env: Record<string, string | undefined> = process.env,
) => Boolean(env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 45_000,
    maxRetries: 1,
  });
  return client;
}

const model = () => process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

type Lang = "es" | "en";

async function callJson<T>(params: {
  system: string;
  content: Anthropic.MessageParam["content"];
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const res = await getClient().messages.create({
    model: model(),
    max_tokens: params.maxTokens ?? 1500,
    system: params.system,
    output_config: { format: { type: "json_schema", schema: params.schema } },
    messages: [{ role: "user", content: params.content }],
  });
  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  if (!text) throw new Error("claude_empty_output");
  return JSON.parse(text) as T;
}

// ---------- Escáner de recibos (HU10–HU12) ----------
const fieldSchema = (type: "string" | "number", description: string) => ({
  type: "object" as const,
  properties: {
    value: { type: [type, "null"], description },
    confidence: {
      type: "number",
      description: "Qué tan seguro estás de la lectura, de 0 a 1.",
    },
  },
  required: ["value", "confidence"],
  additionalProperties: false,
});

const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    provider: fieldSchema(
      "string",
      "Empresa prestadora, tal como aparece (ej. 'Enel Colombia', 'EPM', 'Vanti').",
    ),
    reference: fieldSchema(
      "string",
      "Número de referencia de pago / cuenta / contrato, solo dígitos y letras.",
    ),
    amount: fieldSchema(
      "number",
      "Valor TOTAL a pagar en pesos colombianos, sin separadores.",
    ),
    cutoffDate: fieldSchema(
      "string",
      "Fecha de corte / suspensión en formato YYYY-MM-DD.",
    ),
    dueDate: fieldSchema(
      "string",
      "Fecha límite de pago (pago oportuno) en formato YYYY-MM-DD.",
    ),
    period: fieldSchema("string", "Periodo facturado en formato YYYY-MM."),
    consumption: fieldSchema(
      "number",
      "Consumo del periodo en su unidad (kWh, m³, GB).",
    ),
    serviceType: fieldSchema(
      "string",
      "Uno de: agua, energia, gas, internet, aseo.",
    ),
  },
  required: [
    "provider",
    "reference",
    "amount",
    "cutoffDate",
    "dueDate",
    "period",
    "consumption",
    "serviceType",
  ],
  additionalProperties: false,
};

export async function extractReceipt(input: {
  data: string;
  mediaType: string;
  knownProviders: string[];
}) {
  const fileBlock: Anthropic.ContentBlockParam =
    input.mediaType === "application/pdf"
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: input.data,
          },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: input.mediaType as "image/png" | "image/jpeg",
            data: input.data,
          },
        };
  return callJson<unknown>({
    system:
      "Eres el módulo de lectura de recibos de Oykos. Lees recibos de servicios públicos de Colombia y respondes solo con el JSON pedido. " +
      "Si un dato no aparece o no es legible, usa value null y confidence 0. No inventes valores. Las fechas siempre en YYYY-MM-DD.",
    content: [
      fileBlock,
      {
        type: "text",
        text: `Extrae los datos de este recibo. Empresas que el usuario ya tiene registradas: ${input.knownProviders.join(", ") || "ninguna"}.`,
      },
    ],
    schema: RECEIPT_SCHEMA,
    maxTokens: 1000,
  });
}

// ---------- Asistente (HU07–HU09) ----------
const ASSISTANT_SCHEMA = {
  type: "object",
  properties: {
    profileExplanation: {
      type: "string",
      description:
        "2 o 3 frases que expliquen el perfil de consumo y en qué se basa.",
    },
    scoreExplanation: {
      type: "string",
      description:
        "1 o 2 frases sobre el score de sostenibilidad y qué servicio pesa más.",
    },
    recommendations: {
      type: "array",
      description: "Entre 2 y 5 recomendaciones.",
      items: {
        type: "object",
        properties: {
          serviceType: {
            type: "string",
            enum: ["agua", "energia", "gas", "internet", "aseo"],
          },
          title: {
            type: "string",
            description: "Acción concreta, máximo 12 palabras.",
          },
          reason: {
            type: "string",
            description:
              "Por qué se sugiere, citando el dato del hogar o de hogares similares.",
          },
          estimatedSaving: {
            type: "number",
            description: "Ahorro mensual estimado en COP, realista.",
          },
        },
        required: ["serviceType", "title", "reason", "estimatedSaving"],
        additionalProperties: false,
      },
    },
  },
  required: ["profileExplanation", "scoreExplanation", "recommendations"],
  additionalProperties: false,
};

export async function assistantInsights(input: {
  facts: AssistantFacts;
  profile: ConsumptionProfile;
  score: { value: number; breakdown: unknown[] } | null;
  locale: Lang;
}) {
  const language = input.locale === "en" ? "English" : "español (Colombia)";
  return callJson<unknown>({
    system:
      `Eres el asistente de ahorro de Oykos para hogares colombianos. Responde en ${language}, con tono claro y cercano, solo con el JSON pedido (entre 2 y 5 recomendaciones). ` +
      "Basa todo en los datos entregados (consumos, estrato y referencias de hogares similares). Los ahorros deben ser realistas y nunca mayores al gasto del servicio.",
    content: [
      {
        type: "text",
        text: `Datos del hogar (JSON):\n${JSON.stringify(input)}`,
      },
    ],
    schema: ASSISTANT_SCHEMA,
    maxTokens: 2000,
  });
}
