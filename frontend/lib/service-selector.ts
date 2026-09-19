/**
 * Origyn — Service Selector
 *
 * Exports the active service implementations based on NEXT_PUBLIC_API_MODE.
 * UI components should import from this file instead of directly from
 * chat-service / evidence-service / graph-service.
 */

import { isMock } from './api';

import { chatService as mockChatService } from './chat-service';
import { evidenceService as mockEvidenceService } from './evidence-service';
import { graphService as mockGraphService } from './graph-service';

import { realChatService } from './real-chat-service';
import { realEvidenceService } from './real-evidence-service';
import { realGraphService } from './real-graph-service';

export const activeChatService = isMock ? mockChatService : realChatService;
export const activeEvidenceService = isMock ? mockEvidenceService : realEvidenceService;
export const activeGraphService = isMock ? mockGraphService : realGraphService;
