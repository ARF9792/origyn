import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getAnswer } from "../lib/dynamo";
import { getAuthenticatedOwnerId } from "../lib/auth";

function errorResponse(
  statusCode: number,
  code: string,
  message: string
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ error: { code, message } }),
  };
}

/**
 * GET /answers/:id
 *
 * Returns one persisted answer by ID.
 * Error: ANSWER_NOT_FOUND
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  const ownerId = getAuthenticatedOwnerId(event);

  if (!id) {
    return errorResponse(400, "ANSWER_NOT_FOUND", "Answer ID is required.");
  }

  let answer;
  try {
    answer = await getAnswer(id, ownerId);
  } catch (err) {
    console.error(`DynamoDB getAnswer error for id ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to retrieve answer.");
  }

  if (!answer) {
    return errorResponse(404, "ANSWER_NOT_FOUND", `Answer with id '${id}' was not found.`);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(answer),
  };
};
