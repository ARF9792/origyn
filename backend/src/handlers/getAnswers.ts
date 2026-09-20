import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { listAllAnswers } from "../lib/dynamo";
import { AnswerListResponse } from "../types/document";
import { getWorkspaceId } from "../lib/workspace";

/**
 * GET /answers
 *
 * Returns all persisted answers, most recent first.
 * Response shape: { "items": Answer[] }
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const workspaceId = getWorkspaceId(event);
  let answers;
  try {
    answers = await listAllAnswers(workspaceId);
  } catch (err) {
    console.error("DynamoDB listAllAnswers error:", err);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Failed to retrieve answers." } }),
    };
  }

  // Sort newest first
  answers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const response: AnswerListResponse = { items: answers };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(response),
  };
};
