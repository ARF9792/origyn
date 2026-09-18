/**
 * Origyn — Chat service layer.
 * TypeScript translation of Astra Pass 2 dist/workspace/chat/service.js.
 *
 * All service operations are pure data mutations with no DOM access.
 * State is held in the factory closure; each call to createChatService()
 * returns an independent instance. The exported singleton `chatService`
 * is used throughout the Chat feature.
 *
 * Historical answers are NEVER mutated. Evidence changes create NEW answer
 * versions with a linked previousVersionId / updatedVersionId relationship.
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
} from './types';
import { MOCK_DOCUMENTS } from './mock-data';
import {
  chatThreads,
  chatClaims,
  chatClaimIds,
  chatSourceIds,
  answerCopy,
  CHAT_QUESTION,
  makeAnswer,
  evidenceEvent,
} from './chat-mock-data';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fail(code: string, message: string): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(new DOMException('Cancelled', 'AbortError'));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// ─── Service options ──────────────────────────────────────────────────────────
interface ServiceOptions {
  getSources?: () => Promise<Document[]>;
  latency?: number;
}

interface GenerateOptions {
  signal?: AbortSignal;
  onStage?: (stage: string) => void;
  outcome?: 'normal' | 'failure' | 'insufficient';
}

// ─── Chat service factory ─────────────────────────────────────────────────────
export function createChatService(options: ServiceOptions = {}) {
  const {
    getSources = async () => deepClone(MOCK_DOCUMENTS),
    latency = 500,
  } = options;

  // Session state — cloned from seed fixtures
  let threads: Conversation[] = deepClone(chatThreads);
  let counter = 0;

  // ── Private ──────────────────────────────────────────────────────────────
  function find(id: string): Conversation {
    const thread = threads.find((t) => t.id === id);
    if (!thread) throw fail('CONVERSATION_NOT_FOUND', 'Conversation not found.');
    return thread;
  }

  // ── Public ───────────────────────────────────────────────────────────────

  function listConversations(): Conversation[] {
    return deepClone(threads);
  }

  function getConversation(id: string): Conversation {
    return deepClone(find(id));
  }

  async function context(id: string): Promise<EvidenceContext> {
    const thread = find(id);
    const sources = deepClone(await getSources());

    // In before-retraction replay, treat doc_002 as ACTIVE
    if (thread.snapshot === 'before-retraction') {
      const source = sources.find((d) => d.id === chatSourceIds.removed);
      if (source) {
        source.status = 'ACTIVE';
        source.retractionStatus = 'NONE_FOUND';
        source.retractionNotice = null;
        source.claims.forEach((c) => { c.status = 'SUPPORTED'; });
      }
    }

    return {
      sources,
      usable: sources.filter((d) => d.status === 'ACTIVE'),
      excluded: sources.filter((d) => d.status !== 'ACTIVE'),
      snapshot: thread.snapshot,
    };
  }

  function createConversation({ replay = false }: { replay?: boolean } = {}): Conversation {
    const thread: Conversation = {
      id: `conversation_${++counter}`,
      title: replay ? 'Evidence-change replay' : 'Untitled research question',
      snapshot: replay ? 'before-retraction' : 'current',
      answers: [],
      keptVersions: [],
    };
    threads.push(thread);
    return deepClone(thread);
  }

  function createDemoConversation(kind: 'normal' | 'historical'): Conversation {
    const seed = deepClone(kind === 'normal' ? chatThreads[0] : chatThreads[1]);
    seed.id = `conversation_${++counter}`;
    seed.answers[0].id = `ans_${++counter}`;
    seed.title =
      kind === 'normal' ? 'Current evidence review' : 'Historical evidence review';
    threads.push(seed);
    return deepClone(seed);
  }

  async function getEvidence(threadId: string, answerId: string): Promise<EvidenceResult> {
    const thread = find(threadId);
    const answer = thread.answers.find((a) => a.id === answerId);
    if (!answer) throw fail('ANSWER_NOT_FOUND', 'Answer not found.');

    const ctx = await context(threadId);

    // Resolve each claim, updating status based on current source health
    const resolvedClaims = answer.claimIds
      .map((cid) => {
        const c = deepClone(chatClaims.find((cc) => cc.id === cid));
        if (!c) return null;
        const claimSources = c.sourceIds
          .map((sid) => ctx.sources.find((d) => d.id === sid))
          .filter((s): s is Document => !!s);
        const isSupported = claimSources.some((s) => s.status === 'ACTIVE');
        return {
          ...c,
          status: (isSupported ? 'SUPPORTED' : 'AFFECTED') as ChatClaim['status'],
          sources: claimSources,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return {
      answer: deepClone(answer),
      context: ctx,
      claims: resolvedClaims,
      sources: ctx.sources.filter((d) => answer.sourceIds.includes(d.id)),
    };
  }

  async function generateAnswer(
    threadId: string,
    question: string,
    { signal, onStage = () => {}, outcome = 'normal' }: GenerateOptions = {}
  ): Promise<Answer> {
    if (!question?.trim()) throw fail('EMPTY_QUESTION', 'Write a question first.');
    const thread = find(threadId);
    if (thread.answers.some((a) => a.status === 'GENERATING'))
      throw fail('BUSY', 'An answer is already being generated.');

    for (const stage of [
      'Selecting usable evidence',
      'Assembling claim context',
      'Preparing answer',
    ]) {
      onStage(stage);
      await sleep(latency, signal);
    }

    if (outcome === 'failure')
      throw fail('MODEL_GENERATION_FAILED', answerCopy.failure);

    const ctx = await context(threadId);

    // Match exact prepared question (case-insensitive, strip trailing punctuation)
    const normalise = (s: string) =>
      s.trim().toLowerCase().replace(/[?.!]+$/, '');
    const isPrepared =
      normalise(question) === normalise(CHAT_QUESTION);
    const usable = new Set(ctx.usable.map((s) => s.id));
    const enoughForPrepared = chatSourceIds.remaining.every((id) => usable.has(id));

    let result: Answer;

    if (!isPrepared || outcome === 'insufficient' || !enoughForPrepared) {
      result = makeAnswer(`ans_${++counter}`, 'insufficient', {
        question: question.trim(),
        status: 'INSUFFICIENT' as AnswerStatus,
        sourceIds: [],
        claimIds: [],
        sourceStatusSnapshot: {},
      });
    } else {
      const isBefore = thread.snapshot === 'before-retraction';
      result = makeAnswer(`ans_${++counter}`, isBefore ? 'original' : 'current', {
        question: question.trim(),
        status: 'CURRENT' as AnswerStatus,
        createdAt: isBefore ? '2026-09-15T14:20:00Z' : new Date().toISOString(),
      });
    }

    thread.answers.push(result);
    if (thread.title === 'Untitled research question') {
      thread.title = question.trim().slice(0, 46);
    }
    return deepClone(result);
  }

  function applyRetraction(threadId: string): Conversation {
    const thread = find(threadId);
    thread.snapshot = 'current';
    for (const answer of thread.answers) {
      if (answer.sourceIds.includes(chatSourceIds.removed)) {
        answer.status = 'EVIDENCE_CHANGED';
        answer.evidenceChange = deepClone(evidenceEvent);
      }
    }
    return deepClone(thread);
  }

  async function regenerateAnswer(
    threadId: string,
    answerId: string,
    { signal, onStage = () => {}, outcome = 'normal' }: GenerateOptions = {}
  ): Promise<Answer> {
    const thread = find(threadId);
    const original = thread.answers.find((a) => a.id === answerId);
    if (!original) throw fail('ANSWER_NOT_FOUND', 'Answer not found.');

    // If already regenerated, return the existing updated version
    if (original.updatedVersionId) {
      const existing = thread.answers.find(
        (a) => a.id === original.updatedVersionId
      );
      if (existing) return deepClone(existing);
    }

    if (original.status !== 'EVIDENCE_CHANGED')
      throw fail('EVIDENCE_UNCHANGED', 'This answer has no evidence change to resolve.');

    for (const stage of [
      'Excluding the retracted source',
      'Rebuilding claim context',
      'Preparing a new answer version',
    ]) {
      onStage(stage);
      await sleep(latency, signal);
    }

    if (outcome === 'failure')
      throw fail(
        'MODEL_GENERATION_FAILED',
        'The updated answer could not be generated. The original answer is unchanged.'
      );

    const ctx = await context(threadId);
    const usable = new Set(ctx.usable.map((d) => d.id));

    const remainingSourceIds = original.sourceIds.filter((id) => usable.has(id));
    const remainingClaimIds = original.claimIds.filter((cid) => {
      const claim = chatClaims.find((c) => c.id === cid);
      return claim?.sourceIds.every((sid) => usable.has(sid));
    });
    const enoughForUpdated = chatSourceIds.remaining.every((id) =>
      remainingSourceIds.includes(id)
    );

    const result = makeAnswer(`ans_${++counter}`, 'updated', {
      question: original.question,
      createdAt: new Date().toISOString(),
      sourceIds: remainingSourceIds,
      claimIds: remainingClaimIds,
      previousVersionId: original.id,
      version: original.version + 1,
      status: (enoughForUpdated ? 'CURRENT' : 'INSUFFICIENT') as AnswerStatus,
      text: enoughForUpdated
        ? answerCopy.updated.join('\n\n')
        : answerCopy.insufficient[0],
      sourceStatusSnapshot: Object.fromEntries(
        remainingSourceIds.map((id) => [id, 'ACTIVE' as DocumentStatus])
      ),
      removedSourceIds: original.sourceIds.filter((id) => !remainingSourceIds.includes(id)),
      removedClaimIds: original.claimIds.filter((id) => !remainingClaimIds.includes(id)),
    });

    // Link the versions (original → updated)
    original.updatedVersionId = result.id;
    thread.answers.push(result);
    return deepClone(result);
  }

  function keepBothVersions(threadId: string, answerId: string): Conversation {
    const thread = find(threadId);
    const answer = thread.answers.find((a) => a.id === answerId);
    if (!answer?.updatedVersionId)
      throw fail('VERSION_NOT_FOUND', 'Generate an updated version first.');
    if (!thread.keptVersions.includes(answerId)) {
      thread.keptVersions.push(answerId);
    }
    return deepClone(thread);
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
  };
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const chatService = createChatService();
