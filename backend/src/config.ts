/**
 * config.ts — single source of truth for all environment variables.
 * Never hard-code credentials or secrets here.
 * All values come from process.env, which in AWS Lambda is set via
 * Lambda environment variables (not committed to Git).
 *
 * Day 2 Bedrock model assignments:
 *   BEDROCK_CLAIM_MODEL_ID     → us.amazon.nova-2-lite-v1:0  (claim extraction)
 *   BEDROCK_REASONING_MODEL_ID → amazon.nova-pro-v1:0         (chat + regeneration)
 *   BEDROCK_REGION             → us-east-1
 *   BEDROCK_ROLE_ARN           → optional STS cross-account role ARN
 */

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  aws: {
    region: optional("AWS_REGION", "us-east-1"),
  },
  s3: {
    bucketName: optional("S3_BUCKET_NAME", ""),
  },
  dynamodb: {
    documentsTable: optional("DYNAMODB_DOCUMENTS_TABLE", ""),
    claimsTable: optional("DYNAMODB_CLAIMS_TABLE", ""),
    answersTable: optional("DYNAMODB_ANSWERS_TABLE", ""),
  },
  crossref: {
    /**
     * Crossref polite pool: include a contact email in the User-Agent.
     * https://api.crossref.org/swagger-ui/index.html#/Polite-pool
     */
    contactEmail: optional("CROSSREF_CONTACT_EMAIL", ""),
    baseUrl: optional("CROSSREF_BASE_URL", "https://api.crossref.org"),
  },
  bedrock: {
    /**
     * Amazon Nova 2 Lite — fast, cheap claim extraction.
     * Uses the US cross-region inference profile so both us-east-1 and
     * us-west-2 capacity are available.
     */
    claimModelId: optional("BEDROCK_CLAIM_MODEL_ID", "us.amazon.nova-2-lite-v1:0"),
    /**
     * Amazon Nova Pro — high-quality reasoning for Evidence-Locked chat
     * and answer regeneration.
     */
    reasoningModelId: optional("BEDROCK_REASONING_MODEL_ID", "amazon.nova-pro-v1:0"),
    /** Region where Bedrock endpoints are available. */
    region: optional("BEDROCK_REGION", "us-east-1"),
    /**
     * Optional cross-account role ARN. When set, the Lambda will call
     * STS AssumeRole before invoking Bedrock (friend's account pattern).
     * Leave empty for same-account deployments.
     */
    roleArn: optional("BEDROCK_ROLE_ARN", ""),
  },
};
