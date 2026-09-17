import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { config } from "../config";

/**
 * GET /health
 *
 * Lightweight health-check endpoint.
 * Verifies the Lambda can start, read config, and respond.
 * Does NOT test AWS service connectivity — that requires real credentials.
 */
export const handler = async (
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      status: "ok",
      service: "origyn-backend",
      region: config.aws.region,
      timestamp: new Date().toISOString(),
    }),
  };
};
