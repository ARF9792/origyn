/**
 * Origyn — Real-mode chat service.
 *
 * Implements the same public API surface as chat-service.ts so ChatController
 * can swap seamlessly between mock and real mode via service-selector.ts.
 *
 * CONVERSATION GROUPING RULE:
 *   Each root answer (previousAnswerId === null) = unique conversation.
 *   V2 belongs to V1 only via the previousAnswerId / supersededByAnswerId chain.
 *   Two separately-asked identical questions = two separate conversations.
 *
 * The backend has NO /conversations endpoint.
 * Conversation state is derived from GET /answers and kept in-memory.
 *
 * AbortSignal is threaded through chat and regeneration requests.
 */

import type {
  Answer,
  AnswerStatus,
  Conversation,
  EvidenceContext,
  EvidenceResult,
  ChatClaim,
  Document,
  DocumentStatus,
  DocumentSummary,
  BackendAnswer,
  BackendCitation,
} from './types';
import {
  getDocuments,
  getDocument,
  getAnswers,
  getAnswer,
  chatRequest,
  regenerateAnswerRequest,
} from './api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function fail(code: string, message: string): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

// ─── Backend → Frontend answer adaptor ───────────────────────────────────────
function adaptAnswer(
  raw: BackendAnswer,
  conversationId: string,
  version: number,
  evidenceAtGeneration: string,
  allDocuments: DocumentSummary[] = []
): Answer {
  const ans: Answer = {
    id: raw.id,
    question: raw.question,
    text: raw.text,
    status: raw.status as AnswerStatus,
    createdAt: raw.createdAt,
    claimIds: raw.claimIds,
    // Map backend sourceDocumentIds → frontend sourceIds
    sourceIds: raw.sourceDocumentIds,
    previousVersionId: raw.previousAnswerId,
    updatedVersionId: raw.supersededByAnswerId,
    version,
    evidenceAtGeneration,
    sourceStatusSnapshot: {},
  };

  if (raw.status === 'EVIDENCE_CHANGED' && allDocuments.length > 0) {
    const invalidSource = allDocuments.find(d => 
      raw.sourceDocumentIds.includes(d.id) && d.status !== 'ACTIVE'
    );
    if (invalidSource) {
      ans.evidenceChange = {
        sourceId: invalidSource.id,
        detectedAt: invalidSource.updatedAt || '',
        noticeDate: invalidSource.updatedAt || '',
        previousStatus: 'ACTIVE',
        currentStatus: invalidSource.status,
      };
    }
  }

  return ans;
}

// ─── Derive version number for an answer ─────────────────────────────────────
function deriveVersion(raw: BackendAnswer, allAnswers: BackendAnswer[]): number {
  if (!raw.previousAnswerId) return 1;
  const prev = allAnswers.find((a) => a.id === raw.previousAnswerId);
  if (!prev) return 2;
  return deriveVersion(prev, allAnswers) + 1;
}

// ─── Build conversation from root answer + its version chain ─────────────────
function buildConversation(
  root: BackendAnswer,
  allAnswers: BackendAnswer[],
  allDocuments: DocumentSummary[] = []
): Conversation {
  const id = `conv_${root.id}`;
  const chain: BackendAnswer[] = [root];

  // Follow supersededByAnswerId chain forward
  let current = root;
  while (current.supersededByAnswerId) {
    const next = allAnswers.find((a) => a.id === current.supersededByAnswerId);
    if (!next) break;
    chain.push(next);
    current = next;
  }

  const answers = chain.map((raw, i) =>
    adaptAnswer(raw, id, i + 1, raw.createdAt, allDocuments)
  );

  return {
    id,
    title: root.question.slice(0, 60),
    snapshot: 'current',
    answers,
    keptVersions: [],
  };
}

// ─── Service options ──────────────────────────────────────────────────────────
interface GenerateOptions {
  signal?: AbortSignal;
  onStage?: (stage: string) => void;
}

// ─── Service factory ──────────────────────────────────────────────────────────
export function createRealChatService() {
  // In-memory session state
  // Conversations are keyed by root answer ID
  let conversations: Map<string, Conversation> = new Map();
  // Citations cache for fresh answers from POST /chat
  let citationsCache: Map<string, BackendCitation[]> = new Map();
  // keepBothVersions acknowledgement — local only, both answers already persist
  let keptVersions: Map<string, string[]> = new Map();

  // ── Hydrate conversations from persisted answers ──────────────────────────
  async function hydrateFromBackend(): Promise<void> {
    const { items } = await getAnswers();
    let allDocuments: DocumentSummary[] = [];
    try {
      const docsResp = await getDocuments();
      allDocuments = docsResp.items;
    } catch {
      // ignore
    }

    // Find root answers (no previousAnswerId)
    const roots = items.filter((a) => !a.previousAnswerId);
    const newConvs = new Map<string, Conversation>();
    for (const root of roots) {
      const conv = buildConversation(root, items, allDocuments);
      // Restore local keptVersions if any
      conv.keptVersions = keptVersions.get(conv.id) ?? [];
      newConvs.set(conv.id, conv);
    }
    conversations = newConvs;
  }

  // ── listConversations ─────────────────────────────────────────────────────
  function listConversations(): Conversation[] {
    return Array.from(conversations.values()).map(deepClone);
  }

  // ── getConversation ───────────────────────────────────────────────────────
  function getConversation(id: string): Conversation {
    const conv = conversations.get(id);
    if (!conv) throw fail('CONVERSATION_NOT_FOUND', 'Conversation not found.');
    return deepClone(conv);
  }

  // ── createConversation (ephemeral, receives answers on generate) ──────────
  function createConversation(): Conversation {
    const id = `conv_ephemeral_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const conv: Conversation = {
      id,
      title: 'Untitled research question',
      snapshot: 'current',
      answers: [],
      keptVersions: [],
    };
    conversations.set(id, conv);
    return deepClone(conv);
  }

  // ── context (usable = ACTIVE documents) ──────────────────────────────────
  async function context(_threadId: string): Promise<EvidenceContext> {
    const { items } = await getDocuments();
    // Hydrate each doc to get claims — but for context we only need status
    // Use summary data (status available in list endpoint)
    const sources = items as unknown as Document[];
    return {
      sources,
      usable: sources.filter((d) => d.status === 'ACTIVE'),
      excluded: sources.filter((d) => d.status !== 'ACTIVE'),
      snapshot: 'current',
    };
  }

  // ── getEvidence ───────────────────────────────────────────────────────────
  async function getEvidence(threadId: string, answerId: string): Promise<EvidenceResult> {
    const conv = conversations.get(threadId);
    const answer = conv?.answers.find((a) => a.id === answerId);
    if (!answer) throw fail('ANSWER_NOT_FOUND', 'Answer not found.');

    // Check citations cache first (fresh answers from POST /chat)
    const cachedCitations = citationsCache.get(answerId);

    // Hydrate source documents
    const sourceDocsMap = new Map<string, Document>();
    for (const sid of answer.sourceIds) {
      try {
        const doc = await getDocument(sid);
        sourceDocsMap.set(sid, doc);
      } catch { /* skip unavailable */ }
    }
    const sources = Array.from(sourceDocsMap.values());

    // Build claims from citations (fresh) or from hydrated doc claims (historical)
    let resolvedClaims: (ChatClaim & { sources: Document[] })[];

    if (cachedCitations && cachedCitations.length > 0) {
      // Fresh answer — use citations from POST /chat response
      resolvedClaims = cachedCitations.map((cit) => {
        const doc = sourceDocsMap.get(cit.documentId);
        return {
          id: cit.claimId,
          text: cit.claimText,
          status: 'SUPPORTED' as const,
          sourceIds: [cit.documentId],
          sources: doc ? [doc] : [],
        };
      });
    } else {
      // Historical answer — reconstruct from claimIds + hydrated docs
      const allDocClaims = new Map<string, { text: string; docId: string }>();
      for (const doc of sources) {
        for (const claim of doc.claims ?? []) {
          allDocClaims.set(claim.id, { text: claim.text, docId: doc.id });
        }
      }

      resolvedClaims = answer.claimIds
        .map((cid) => {
          const found = allDocClaims.get(cid);
          if (!found) return null;
          const doc = sourceDocsMap.get(found.docId);
          const isActive = doc?.status === 'ACTIVE';
          return {
            id: cid,
            text: found.text,
            status: (isActive ? 'SUPPORTED' : 'AFFECTED') as ChatClaim['status'],
            sourceIds: [found.docId],
            sources: doc ? [doc] : [],
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
    }

    const ctx = await context(threadId);
    return {
      answer: deepClone(answer),
      context: ctx,
      claims: resolvedClaims,
      sources,
    };
  }

  // ── generateAnswer ─────────────────────────────────────────────────────────
  async function generateAnswer(
    threadId: string,
    question: string,
    { signal, onStage = () => {} }: GenerateOptions = {}
  ): Promise<Answer> {
    if (!question?.trim()) throw fail('EMPTY_QUESTION', 'Write a question first.');

    const conv = conversations.get(threadId);
    if (!conv) throw fail('CONVERSATION_NOT_FOUND', 'Conversation not found.');

    onStage('Selecting usable evidence');

    let backendResp;
    try {
      backendResp = await chatRequest(question.trim(), signal);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === 'NO_USABLE_EVIDENCE') {
        // Map to INSUFFICIENT answer so ChatController shows the right state
        const insufficient: Answer = {
          id: `ans_insuf_${Date.now()}`,
          question: question.trim(),
          text: e.message,
          status: 'INSUFFICIENT',
          createdAt: new Date().toISOString(),
          claimIds: [],
          sourceIds: [],
          previousVersionId: null,
          updatedVersionId: null,
          version: 1,
          evidenceAtGeneration: new Date().toISOString(),
          sourceStatusSnapshot: {},
        };
        conv.answers.push(insufficient);
        if (conv.title === 'Untitled research question') {
          conv.title = question.trim().slice(0, 60);
        }
        return deepClone(insufficient);
      }
      throw err;
    }

    onStage('Preparing answer');

    // Adapt backend answer
    const answer = adaptAnswer(backendResp.answer, threadId, 1, backendResp.answer.createdAt);

    // Cache citations for evidence inspector
    if (backendResp.citations?.length) {
      citationsCache.set(answer.id, backendResp.citations);
    }

    conv.answers.push(answer);
    if (conv.title === 'Untitled research question') {
      conv.title = question.trim().slice(0, 60);
    }

    // Also register this as a root conversation by root answer id
    const rootConvId = `conv_${answer.id}`;
    conversations.set(rootConvId, {
      ...deepClone(conv),
      id: rootConvId,
    });

    return deepClone(answer);
  }

  // ── regenerateAnswer ───────────────────────────────────────────────────────
  async function regenerateAnswer(
    threadId: string,
    answerId: string,
    { signal, onStage = () => {} }: GenerateOptions = {}
  ): Promise<Answer> {
    const conv = conversations.get(threadId);
    const original = conv?.answers.find((a) => a.id === answerId);
    if (!conv || !original) throw fail('ANSWER_NOT_FOUND', 'Answer not found.');

    // If already regenerated, return existing updated version
    if (original.updatedVersionId) {
      const existing = conv.answers.find((a) => a.id === original.updatedVersionId);
      if (existing) return deepClone(existing);
    }

    if (original.status !== 'EVIDENCE_CHANGED') {
      throw fail('EVIDENCE_UNCHANGED', 'This answer has no evidence change to resolve.');
    }

    onStage('Excluding unusable evidence');

    let backendResp;
    try {
      backendResp = await regenerateAnswerRequest(answerId, signal);
    } catch (err: unknown) {
      throw err;
    }

    onStage('Preparing new answer version');

    // Backend marks old answer EVIDENCE_CHANGED — update local state
    original.status = backendResp.previousAnswer.status as AnswerStatus;

    const newAnswer = adaptAnswer(
      backendResp.answer,
      threadId,
      original.version + 1,
      backendResp.answer.createdAt
    );

    // Link versions
    original.updatedVersionId = newAnswer.id;

    // Cache citations if backend provides them (regenerate may not include citations)
    conv.answers.push(newAnswer);

    return deepClone(newAnswer);
  }

  // ── keepBothVersions (local acknowledgement — both already persist) ─────────
  function keepBothVersions(threadId: string, answerId: string): Conversation {
    const conv = conversations.get(threadId);
    const answer = conv?.answers.find((a) => a.id === answerId);
    if (!conv || !answer?.updatedVersionId) {
      throw fail('VERSION_NOT_FOUND', 'Generate an updated version first.');
    }
    if (!conv.keptVersions.includes(answerId)) {
      conv.keptVersions.push(answerId);
      keptVersions.set(threadId, conv.keptVersions);
    }
    return deepClone(conv);
  }

  // ── applyRetraction (no-op in real mode — backend drives status) ──────────
  function applyRetraction(threadId: string): Conversation {
    const conv = conversations.get(threadId);
    if (!conv) throw fail('CONVERSATION_NOT_FOUND', 'Conversation not found.');
    return deepClone(conv);
  }

  // ── createDemoConversation (mock-only stub — real mode ignores) ────────────
  function createDemoConversation(_kind: string): Conversation {
    return createConversation();
  }

  return {
    listConversations,
    getConversation,
    createConversation,
    createDemoConversation,
    getEvidence,
    context,
    generateAnswer,
    applyRetraction,
    regenerateAnswer,
    keepBothVersions,
    hydrateFromBackend,
  };
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const realChatService = createRealChatService();
