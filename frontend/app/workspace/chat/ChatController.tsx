'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { CurrentEvidenceContext } from '@/components/chat/CurrentEvidenceContext';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatEmptyState } from '@/components/chat/ChatEmptyState';
import { ChatAnswer } from '@/components/chat/ChatAnswer';
import { EvidenceChangedBanner } from '@/components/chat/EvidenceChangedBanner';
import { AnswerLoading } from '@/components/chat/AnswerLoading';
import { GenerationError } from '@/components/chat/GenerationError';
import { EvidenceDrawer } from '@/components/chat/EvidenceDrawer';
import { chatService } from '@/lib/chat-service';
import { chatDemoStates } from '@/lib/chat-mock-data';
import type { Conversation, EvidenceContext, EvidenceResult, GenerationPending, ChatDemoState } from '@/lib/types';

/**
 * ChatController — top-level client component state machine.
 * Translates controller.js logic into React state.
 */
export function ChatController() {
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const [threadId, setThreadId] = useState<string | null>(null);
  const [thread, setThread] = useState<Conversation | null>(null);
  const [context, setContext] = useState<EvidenceContext | null>(null);
  const [draft, setDraft] = useState('');
  const [demoState, setDemoState] = useState<ChatDemoState>('empty');
  
  // Ephemeral state
  const [pending, setPending] = useState<GenerationPending | null>(null);
  const [inspectedEvidence, setInspectedEvidence] = useState<EvidenceResult | null>(null);
  const [inspectedClaimId, setInspectedClaimId] = useState<string | null>(null);
  const [versionSelections, setVersionSelections] = useState<Record<string, string>>({});
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isBusy = !!pending && !pending.error && !pending.cancelled;
  const isHistorical = thread?.snapshot === 'before-retraction';
  
  // Track all threads for the conversation switcher
  const [allThreads, setAllThreads] = useState<Conversation[]>([]);

  // ── Sync ───────────────────────────────────────────────────────────────────
  const refresh = useCallback(async (id: string | null = threadId) => {
    if (!id) return;
    try {
      const updatedThread = chatService.getConversation(id);
      const updatedContext = await chatService.context(id);
      setThread(updatedThread);
      setContext(updatedContext);
      setAllThreads(chatService.listConversations());
      
      setVersionSelections((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const answer of updatedThread.answers) {
          if (!next[answer.id] && !answer.previousVersionId) {
            next[answer.id] = answer.updatedVersionId || answer.id;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } catch (err) {
      console.error(err);
    }
  }, [threadId]);

  // Initial load
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const convParam = searchParams.get('conversation');
    const ansParam = searchParams.get('answer');
    const inspectParam = searchParams.get('inspect');

    let t;
    if (convParam && chatService.listConversations().some(c => c.id === convParam)) {
      t = chatService.getConversation(convParam);
      setThreadId(t.id);

      if (ansParam) {
        const baseAnswerId = t.answers.find(a => a.id === ansParam)?.previousVersionId || ansParam;
        setVersionSelections(prev => ({ ...prev, [baseAnswerId]: ansParam }));
        
        if (inspectParam === '1') {
          chatService.getEvidence(t.id, ansParam).then(setInspectedEvidence).catch(console.error);
        }
      }
    } else {
      t = chatService.createDemoConversation('normal');
      setThreadId(t.id);
    }
  }, [searchParams]);

  useEffect(() => {
    refresh();
  }, [threadId, refresh]);

  // ── Actions ────────────────────────────────────────────────────────────────
  
  function handleNewConversation() {
    const t = chatService.createConversation();
    setThreadId(t.id);
    setDraft('');
    setPending(null);
    setDemoState('empty');
  }

  function handleDemoStateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const state = e.target.value as ChatDemoState;
    setDemoState(state);
    
    abortControllerRef.current?.abort();
    setPending(null);
    
    if (state === 'empty') {
      const t = chatService.createConversation();
      setThreadId(t.id);
    } else if (state === 'normal' || state === 'evidence') {
      const t = chatService.createDemoConversation('normal');
      setThreadId(t.id);
      if (state === 'evidence') {
        chatService.getEvidence(t.id, t.answers[0].id).then(setInspectedEvidence);
      }
    } else if (state === 'historical') {
      const t = chatService.createDemoConversation('historical');
      setThreadId(t.id);
    } else if (state === 'updated') {
      const t = chatService.createDemoConversation('historical');
      const original = t.answers[0];
      setThreadId(t.id);
      // Automatically generate the updated answer for the demo state
      chatService.regenerateAnswer(t.id, original.id).then(() => refresh(t.id));
    } else if (state === 'loading') {
      const t = chatService.createConversation();
      setThreadId(t.id);
      setDraft('');
      setPending({ kind: 'generate', question: 'What does the current evidence say about repeated cognitive training and neural adaptation?', answerId: null, stage: 'Preparing...', error: null, cancelled: false });
    } else if (state === 'insufficient') {
      const t = chatService.createConversation();
      setThreadId(t.id);
      chatService.generateAnswer(t.id, 'Does cognitive training prevent dementia?', { outcome: 'insufficient' }).then(() => refresh(t.id));
    } else if (state === 'regenerating') {
      const t = chatService.createDemoConversation('historical');
      setThreadId(t.id);
      setPending({ kind: 'regenerate', question: t.answers[0].question, answerId: t.answers[0].id, stage: 'Preparing...', error: null, cancelled: false });
    } else if (state === 'failure') {
      const t = chatService.createConversation();
      setThreadId(t.id);
      setPending({ kind: 'generate', question: 'What does the current evidence say about repeated cognitive training and neural adaptation?', answerId: null, stage: 'Preparing...', error: 'Model generation failed. The research workspace is preserved.', cancelled: false });
    }
  }

  function handleReplayHistorical() {
    const t = chatService.createConversation({ replay: true });
    setThreadId(t.id);
    setDraft('What does the current evidence say about repeated cognitive training and neural adaptation?');
    setDemoState('normal'); // reset demo select
  }

  async function runGeneration(question: string) {
    if (!threadId) return;
    
    const abort = new AbortController();
    abortControllerRef.current = abort;
    
    setPending({
      kind: 'generate',
      question,
      answerId: null,
      stage: 'Preparing...',
      error: null,
      cancelled: false
    });
    setDraft('');

    try {
      await chatService.generateAnswer(threadId, question, {
        signal: abort.signal,
        onStage: (s) => setPending(p => (p ? { ...p, stage: s } : null)),
        outcome: demoState === 'failure' ? 'failure' : demoState === 'insufficient' ? 'insufficient' : 'normal'
      });
      setPending(null);
      refresh();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setPending(p => p ? { ...p, error: err.message } : null);
    }
  }

  async function runRegeneration(answerId: string) {
    if (!threadId) return;
    
    const abort = new AbortController();
    abortControllerRef.current = abort;
    
    const thread = chatService.getConversation(threadId);
    const answer = thread.answers.find(a => a.id === answerId);
    if (!answer) return;

    setPending({
      kind: 'regenerate',
      question: answer.question,
      answerId,
      stage: 'Preparing...',
      error: null,
      cancelled: false
    });

    try {
      await chatService.regenerateAnswer(threadId, answerId, {
        signal: abort.signal,
        onStage: (s) => setPending(p => (p ? { ...p, stage: s } : null)),
        outcome: demoState === 'failure' ? 'failure' : 'normal'
      });
      setPending(null);
      
      const updatedThread = chatService.getConversation(threadId);
      const answerRecord = updatedThread.answers.find(a => a.id === answerId);
      if (answerRecord?.updatedVersionId) {
        setVersionSelections(prev => ({ ...prev, [answerId]: answerRecord.updatedVersionId! }));
      }
      
      refresh();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setPending(p => p ? { ...p, error: err.message } : null);
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
    setPending(p => p ? { ...p, cancelled: true, error: null } : null);
  }

  function handleApplyRetraction() {
    if (!threadId) return;
    chatService.applyRetraction(threadId);
    refresh();
  }

  function handleKeepBoth(answerId: string) {
    if (!threadId) return;
    chatService.keepBothVersions(threadId, answerId);
    refresh();
  }

  function handleChangeVersion(originalAnswerId: string, versionToSelect: string) {
    setVersionSelections(prev => ({
      ...prev,
      [originalAnswerId]: versionToSelect
    }));
  }

  function handleInspectEvidence(answerId: string, claimId?: string) {
    if (!threadId) return;
    setInspectedClaimId(claimId || null);
    chatService.getEvidence(threadId, answerId).then(setInspectedEvidence).catch(console.error);
  }

  function handleCloseInspector() {
    setInspectedEvidence(null);
    setInspectedClaimId(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!thread || !context) return null; // Initial mount

  // Visible answers filter: only show base answers (no previousVersionId)
  // For each base answer, show the selected version (from versionSelections)
  const baseAnswers = thread.answers.filter((a) => !a.previousVersionId);
  const renderedAnswers = baseAnswers.map((base) => {
    const selectedId = versionSelections[base.id] || base.id;
    const selectedAnswer = thread.answers.find((a) => a.id === selectedId) || base;
    return { base, selectedAnswer };
  });
  
  // Find retracted source for banner using ONLY sources in the selected answer
  const retractedSource = context.sources.find(
    (s) => s.status === 'RETRACTED' && renderedAnswers.length > 0 && renderedAnswers[renderedAnswers.length - 1].selectedAnswer.sourceIds.includes(s.id)
  );

  return (
    <div className="chat-page">
      <div className="chat-page-header">
        <div>
          <h1>Evidence-Locked Chat</h1>
          <p>Interact with your uploaded literature.</p>
        </div>
        <div>
          <details className="chat-state-menu">
            <summary>
              <Icon name="chevron" /> Preview state
            </summary>
            <div>
              <label>Jump to state</label>
              <select value={demoState} onChange={handleDemoStateChange}>
                {chatDemoStates.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <p>This is a prototyping tool. It safely resets the local mock fixture state.</p>
            </div>
          </details>
          <button className="button" onClick={handleNewConversation}>
            <Icon name="plus" /> New conversation
          </button>
        </div>
      </div>

      <CurrentEvidenceContext context={context} />

      <div className="conversation-toolbar">
        <select
          aria-label="Conversation history"
          value={threadId || ''}
          onChange={(e) => setThreadId(e.target.value)}
        >
          {allThreads.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <span>
          Snapshot: {isHistorical ? 'Before retraction' : 'Current'}
        </span>
      </div>

      {isHistorical && (
        <div className="replay-notice">
          <Icon name="clock" />
          <div>
            <b>Before the evidence changed</b>
            <p>This chat is replaying the 15 Sep snapshot, when the training source was usable. The source library remains unchanged.</p>
          </div>
          <button
            className="button compact"
            onClick={handleApplyRetraction}
            disabled={renderedAnswers.length === 0 || isBusy}
          >
            Apply retraction event
          </button>
        </div>
      )}

      <div className="chat-transcript">
        {renderedAnswers.length === 0 && !pending && (
          <ChatEmptyState onSuggest={(q: string) => runGeneration(q)} />
        )}

        {renderedAnswers.map(({ base, selectedAnswer }, idx) => (
          <div key={base.id} className="chat-exchange">
            <div className="user-question">
              <div className="question-meta">
                <Icon name="chat" />
                <time>{new Date(base.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
              </div>
              {base.question}
            </div>

            {/* If this is the last exchange, show the banner if applicable */}
            {idx === renderedAnswers.length - 1 && retractedSource && (
              <EvidenceChangedBanner
                answer={selectedAnswer}
                source={retractedSource}
              />
            )}

            <ChatAnswer
              answer={selectedAnswer}
              baseAnswer={base}
              sources={context.sources.filter(s => selectedAnswer.sourceIds.includes(s.id))}
              keptVersions={thread.keptVersions}
              currentVersionId={selectedAnswer.id}
              originalVersionId={base.id}
              onChangeVersion={(ver: string) => handleChangeVersion(base.id, ver)}
              onKeepBoth={handleKeepBoth}
              onRegenerate={runRegeneration}
              onInspectEvidence={handleInspectEvidence}
            />

            {pending?.answerId === base.id && (
              <div className="chat-exchange">
                {pending.error ? (
                  <GenerationError error={pending.error} onRetry={() => runRegeneration(base.id)} />
                ) : pending.cancelled ? (
                   <div className="chat-pending">
                     <div className="generation-stage">
                       <Icon name="warning" /> Regeneration cancelled.
                     </div>
                   </div>
                ) : (
                  <AnswerLoading stage={pending.stage} kind={pending.kind} />
                )}
              </div>
            )}
          </div>
        ))}

        {pending && !pending.answerId && (
          <div className="chat-exchange">
            <div className="user-question">
              <div className="question-meta">
                <Icon name="chat" />
                <time>Now</time>
              </div>
              {pending.question}
            </div>
            
            {pending.error ? (
              <GenerationError error={pending.error} onRetry={() => runGeneration(pending.question)} />
            ) : pending.cancelled ? (
               <div className="chat-pending">
                 <div className="generation-stage">
                   <Icon name="warning" /> Generation cancelled.
                 </div>
               </div>
            ) : (
              <AnswerLoading stage={pending.stage} kind={pending.kind} />
            )}
          </div>
        )}

        {!isHistorical && (
          <div className="replay-notice">
            <Icon name="info" />
            <div>
              <b>Prototyping controls</b>
              <p>Replay this conversation to see how the system handles a sudden change in evidence.</p>
            </div>
            <button className="button compact" onClick={handleReplayHistorical}>
              <Icon name="refresh" /> Replay evidence change
            </button>
          </div>
        )}
      </div>

      <ChatComposer
        draft={draft}
        busy={isBusy}
        onSubmit={runGeneration}
        onStop={handleStop}
        onChange={setDraft}
      />

      <EvidenceDrawer
        evidence={inspectedEvidence}
        focusedClaimId={inspectedClaimId}
        onClose={handleCloseInspector}
      />
    </div>
  );
}
