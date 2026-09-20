/**
 * bedrockService.ts
 *
 * Thin wrapper around the AWS Bedrock Converse API.
 *
 * Responsibilities:
 *  1. Build a BedrockRuntimeClient, optionally assuming a cross-account role
 *     via STS when BEDROCK_ROLE_ARN is configured.
 *  2. Expose two high-level helpers:
 *       extractClaimsFromText(text, documentId) → Claim[]
 *       generateGroundedAnswer(question, evidence) → { text, usedClaimIds }
 *
 * Rules:
 *  - NEVER send retracted/invalid evidence to the model.
 *    That filtering must be done by the calling handler BEFORE this service.
 *  - The model NEVER decides whether a source is retracted/valid.
 *  - Bedrock calls must be mockable in unit tests (export the client getter).
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config";
import { Claim, Document } from "../types/document";

// ── Client factory ────────────────────────────────────────────────────────────

let _client: BedrockRuntimeClient | null = null;

/**
 * Returns a cached BedrockRuntimeClient.
 * If BEDROCK_ROLE_ARN is set, assumes that role via STS and uses the
 * resulting temporary credentials (cross-account Bedrock pattern).
 * Call refreshBedrockClient() to force a new client (e.g., in tests).
 */
export async function getBedrockClient(): Promise<BedrockRuntimeClient> {
  if (_client) return _client;

  const roleArn = config.bedrock.roleArn;
  const region = config.bedrock.region;

  if (roleArn) {
    const sts = new STSClient({ region: "us-east-1" });
    const assumed = await sts.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: "origyn-bedrock-session",
        DurationSeconds: 3600,
      })
    );
    const creds = assumed.Credentials;
    if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken) {
      throw new Error("STS AssumeRole returned incomplete credentials.");
    }
    _client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        sessionToken: creds.SessionToken,
      },
    });
  } else {
    _client = new BedrockRuntimeClient({ region });
  }

  return _client;
}

/** Force a new client on next call — useful for tests and credential refresh. */
export function refreshBedrockClient(): void {
  _client = null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Send a single-turn message and return the full text response. */
async function converse(modelId: string, userMessage: string): Promise<string> {
  const client = await getBedrockClient();
  const messages: Message[] = [
    { role: "user", content: [{ text: userMessage } as ContentBlock] },
  ];
  const cmd = new ConverseCommand({ modelId, messages });
  const response = await client.send(cmd);

  const output = response.output?.message?.content;
  if (!output || output.length === 0) {
    throw new Error("Bedrock returned an empty response.");
  }
  const textBlock = output.find((b) => "text" in b) as { text: string } | undefined;
  if (!textBlock?.text) {
    throw new Error("Bedrock response contained no text block.");
  }
  return textBlock.text;
}

// ── Claim extraction ──────────────────────────────────────────────────────────

/**
 * Structured claim response expected from Nova 2 Lite.
 * We validate against this shape before trusting the model output.
 */
interface RawClaimOutput {
  claims: Array<{ text: string }>;
}

function isRawClaimOutput(value: unknown): value is RawClaimOutput {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.claims)) return false;
  return obj.claims.every(
    (c) => typeof c === "object" && c !== null && typeof (c as Record<string, unknown>).text === "string"
  );
}

/**
 * Send document text to Nova 2 Lite and return 8–15 persisted-ready claims.
 * Does NOT write to DynamoDB — caller persists.
 *
 * @param text     Cleaned PDF text (truncated to fit context window if needed).
 * @param documentId  The source document ID — embedded in each returned claim.
 */
export async function extractClaimsFromText(
  text: string,
  documentId: string,
  ownerId: string
): Promise<Claim[]> {
  // Truncate to ~80 000 characters to stay within Nova 2 Lite context limits.
  const MAX_CHARS = 80_000;
  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const prompt = `You are an evidence extraction assistant for a scientific research validation system.

Your task: read the provided scientific paper text and extract 8 to 15 ATOMIC scientific claims that are:
- Directly stated or strongly supported by the document text
- Each independently understandable without context from other claims
- Specific (include numbers, measurements, percentages, effect sizes where present)
- Factual assertions only — no vague summaries, no meta-commentary about the paper
- Based ONLY on what appears in the text — do not add prior knowledge

Do NOT assess whether the paper is valid, retracted, or scientifically sound. That is not your role.
Do NOT include claims about methodology quality, paper structure, or general observations.

Respond with a JSON object in EXACTLY this format — no extra text outside the JSON:
{
  "claims": [
    { "text": "First atomic claim here." },
    { "text": "Second atomic claim here." }
  ]
}

PAPER TEXT:
${truncated}`;

  const raw = await converse(config.bedrock.claimModelId, prompt);

  // Extract JSON from the response (model may wrap in markdown fences)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Model response did not contain a JSON object.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Model returned invalid JSON for claim extraction.");
  }

  if (!isRawClaimOutput(parsed)) {
    throw new Error("Model JSON did not match expected claim schema.");
  }

  const now = new Date().toISOString();
  return parsed.claims
    .filter((c) => c.text.trim().length > 10) // discard empty/trivial entries
    .slice(0, 15)
    .map((c) => ({
      id: `claim_${uuidv4().replace(/-/g, "").slice(0, 12)}`,
      documentId,
      ownerId,
      sourceDocumentIds: [documentId],
      text: c.text.trim(),
      status: "SUPPORTED" as const,
      createdAt: now,
      updatedAt: now,
    }));
}

// ── Evidence-Locked answer generation ────────────────────────────────────────

export interface EvidenceItem {
  claimId: string;
  claimText: string;
  documentId: string;
  documentTitle: string | null;
}

export interface GroundedAnswerResult {
  text: string;
  usedClaimIds: string[];
}

interface RawAnswerOutput {
  answer: string;
  usedClaimIds: string[];
}

function isRawAnswerOutput(value: unknown): value is RawAnswerOutput {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.answer === "string" &&
    Array.isArray(obj.usedClaimIds) &&
    (obj.usedClaimIds as unknown[]).every((id) => typeof id === "string")
  );
}

/**
 * Call Nova Pro to generate a grounded answer from ONLY the supplied evidence.
 * The caller is responsible for ensuring evidence contains ONLY usable claims
 * (SUPPORTED, from ACTIVE documents).
 *
 * @param question  The user's research question.
 * @param evidence  Pre-filtered, usable evidence items.
 * @param allowedClaimIds  Set of claim IDs supplied to the model — used to
 *                         validate that the model only cites evidence we gave it.
 */
export async function generateGroundedAnswer(
  question: string,
  evidence: EvidenceItem[],
  allowedClaimIds: Set<string>
): Promise<GroundedAnswerResult> {
  const evidenceBlock = evidence
    .map(
      (e) =>
        `Claim ID: ${e.claimId}\nSource: ${e.documentTitle ?? "Unknown"} (${e.documentId})\nClaim: ${e.claimText}`
    )
    .join("\n\n");

  const prompt = `You are an evidence-locked research assistant.
You must answer the user's question using ONLY the provided scientific evidence claims below.

Rules:
- Base your answer ONLY on the claims provided. Do not use external knowledge.
- Cite claim IDs (exactly as written) for every statement you make.
- If the evidence is insufficient or irrelevant to the question, say so clearly.
- Return a JSON object in EXACTLY this format — no text outside the JSON:
{
  "answer": "Your complete answer here, citing claims by ID.",
  "usedClaimIds": ["claim_abc123", "claim_def456"]
}

QUESTION: ${question}

EVIDENCE CLAIMS:
${evidenceBlock}`;

  const raw = await converse(config.bedrock.reasoningModelId, prompt);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Model response did not contain a JSON object.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Model returned invalid JSON for answer generation.");
  }

  if (!isRawAnswerOutput(parsed)) {
    throw new Error("Model JSON did not match expected answer schema.");
  }

  // Security: validate every returned claim ID against what we supplied.
  // Never trust a claim ID the model invented.
  const validatedClaimIds = parsed.usedClaimIds.filter((id) =>
    allowedClaimIds.has(id)
  );

  return {
    text: parsed.answer,
    usedClaimIds: validatedClaimIds,
  };
}
