import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { listDocuments, listAllClaims, listAllAnswers } from "../lib/dynamo";
import { GraphResponse, GraphNode, GraphEdge } from "../types/document";
import { getAuthenticatedOwnerId } from "../lib/auth";

/**
 * GET /graph
 *
 * Day 2: returns real Document → Claim → Answer lineage.
 *
 * Node types (uppercase per Day 2 API contract):
 *   DOCUMENT — source papers
 *   CLAIM    — Bedrock-extracted atomic claims
 *   ANSWER   — Evidence-Locked chat answers
 *
 * Edge types:
 *   SUPPORTS — Document → Claim  (documentId → claim.id)
 *   USED_BY  — Claim   → Answer  (claim.id  → answer.id)
 *
 * Only edges backed by stored IDs are emitted — no synthetic or inferred edges.
 * On Day 2 before Bedrock is unblocked, CLAIM and ANSWER nodes will be empty;
 * the graph will automatically populate once claim extraction runs.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const ownerId = getAuthenticatedOwnerId(event);
  // ── Fetch all three entity types in parallel ──────────────────────────────
  let documents, claims, answers;
  try {
    [documents, claims, answers] = await Promise.all([
      listDocuments(ownerId),
      listAllClaims(ownerId),
      listAllAnswers(ownerId),
    ]);
  } catch (err) {
    console.error("DynamoDB graph fetch error:", err);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Failed to build evidence graph." },
      }),
    };
  }

  // ── Build nodes ───────────────────────────────────────────────────────────
  const documentNodes: GraphNode[] = documents.map((doc) => ({
    id: doc.id,
    type: "DOCUMENT",
    label: doc.title ?? doc.filename,
    status: doc.status,
  }));

  const claimNodes: GraphNode[] = claims.map((claim) => ({
    id: claim.id,
    type: "CLAIM",
    // Truncate long claim text for the graph label
    label: claim.text.length > 80 ? claim.text.slice(0, 77) + "…" : claim.text,
    status: claim.status,
  }));

  const answerNodes: GraphNode[] = answers.map((answer) => ({
    id: answer.id,
    type: "ANSWER",
    // Use truncated question as the label
    label: answer.question.length > 80 ? answer.question.slice(0, 77) + "…" : answer.question,
    status: answer.status,
  }));

  // ── Build edges ───────────────────────────────────────────────────────────
  // SUPPORTS: Document → Claim (one edge per sourceDocumentId on the claim)
  const documentIds = new Set(documents.map((d) => d.id));
  const supportsEdges: GraphEdge[] = [];
  for (const claim of claims) {
    for (const sourceDocId of claim.sourceDocumentIds) {
      if (documentIds.has(sourceDocId)) {
        supportsEdges.push({ source: sourceDocId, target: claim.id, type: "SUPPORTS" });
      }
    }
  }

  // USED_BY: Claim → Answer (one edge per claimId on the answer)
  const claimIds = new Set(claims.map((c) => c.id));
  const usedByEdges: GraphEdge[] = [];
  for (const answer of answers) {
    for (const claimId of answer.claimIds) {
      if (claimIds.has(claimId)) {
        usedByEdges.push({ source: claimId, target: answer.id, type: "USED_BY" });
      }
    }
  }

  const graph: GraphResponse = {
    nodes: [...documentNodes, ...claimNodes, ...answerNodes],
    edges: [...supportsEdges, ...usedByEdges],
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(graph),
  };
};
