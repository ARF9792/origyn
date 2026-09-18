/**
 * Origyn — centralised mock fixtures.
 * Fictional research records for interface development and testing.
 * No real scholarly status or scientific conclusion is asserted.
 * These records must match the Day 1 API contract shapes.
 */

import type {
  Document,
  AnalysisStage,
  RetractionNotice,
  Claim,
} from './types';

// ─── Workspace ────────────────────────────────────────────────────────────────
export const MOCK_WORKSPACE = {
  name: 'Neuroplasticity review',
  initials: 'NR',
  snapshot: '18 Sep 2026',
  description: 'Evidence and provenance for your literature review.',
};

// ─── Analysis stages ─────────────────────────────────────────────────────────
export const ANALYSIS_STAGES: AnalysisStage[] = [
  { id: 'uploading', label: 'Uploading PDF',                done: 'PDF uploaded' },
  { id: 'metadata',  label: 'Extracting metadata',          done: 'Metadata extracted' },
  { id: 'doi',       label: 'Identifying DOI',              done: 'DOI identified' },
  { id: 'checking',  label: 'Checking scholarly metadata',  done: 'Scholarly metadata checked' },
  { id: 'preparing', label: 'Preparing source',             done: 'Source prepared' },
];

// ─── Demo states ──────────────────────────────────────────────────────────────
export const DEMO_STATES: [string, string][] = [
  ['empty',     'Empty dropzone'],
  ['selected',  'File selected'],
  ['invalid',   'Invalid PDF'],
  ['uploading', 'Uploading'],
  ['metadata',  'Metadata extracted'],
  ['doi',       'Identifying DOI'],
  ['checking',  'Checking scholarly metadata'],
  ['preparing', 'Preparing source'],
  ['success',   'Success'],
  ['retracted', 'Retracted result'],
  ['unknown',   'Unable to verify'],
  ['failure',   'Failure'],
];

// ─── Retraction notice ───────────────────────────────────────────────────────
const RETRACTION_NOTICE: RetractionNotice = {
  doi: '10.0000/origyn.notice.002',
  date: '2026-09-16',
  source: 'publisher',
  title: 'Retraction: Neural adaptation following repeated cognitive training',
  reason:
    'The publisher withdrew the article after concerns about the underlying data. ' +
    'This is a fictional notice for interface review.',
};

// ─── Claim text fixtures ──────────────────────────────────────────────────────
const CLAIM_TEXT: Record<string, string[]> = {
  doc_001: [
    'The study reports improved task retention after a period of sleep.',
    'The observed effect varied with the interval between training and recall.',
    'The authors identify sample size as a limitation of the study.',
  ],
  doc_002: [
    'Repeated training was associated with changes in task performance.',
    'The paper reported a difference between training and comparison groups.',
    'The authors attributed the observed change to neural adaptation.',
  ],
};

function makeClaims(doc: Omit<Document, 'claims'>, count: number): Claim[] {
  const idx = parseInt(doc.id.replace('doc_', ''), 10);
  return Array.from({ length: count }, (_, i) => ({
    id: `${doc.id}_claim_${i + 1}`,
    label: `CL-${String(idx * 10 + i + 1).padStart(3, '0')}`,
    text:
      CLAIM_TEXT[doc.id]?.[i] ??
      ['The study describes changes in measured performance across sessions.', 'The authors report variation in individual responses.'][i % 2],
    status: doc.status === 'RETRACTED' ? 'AFFECTED' : 'SUPPORTED',
    sourceId: doc.id,
    page: i + 3,
    quote:
      doc.status === 'RETRACTED'
        ? 'This excerpt is retained for provenance. Its source has been retracted.'
        : 'Illustrative excerpt from the uploaded document. The result is limited to the study design and sample.',
    answerCount: i === 0 ? doc.usage?.answers ?? 0 : 0,
  }));
}

// ─── Raw record tuples ────────────────────────────────────────────────────────
// [id, title, authors, journal, year, status, identificationMethod, claimCount, answerCount, summaryCount]
type RawRecord = [
  string, string, string, string, number,
  Document['status'], string,
  number, number, number
];

const RAW: RawRecord[] = [
  ['doc_001','Sleep-dependent consolidation of motor learning','A. Chen, M. Patel & R. Evans','Journal of Cognitive Research',2025,'ACTIVE','doi-in-text',3,2,1],
  ['doc_002','Neural adaptation following repeated cognitive training','L. Morgan, J. Park & S. Rivera','Experimental Neuroscience',2024,'RETRACTED','doi-in-text',3,2,1],
  ['doc_003','Longitudinal markers of cortical plasticity','M. Okafor & E. Laurent','Unconfirmed publication',2025,'UNKNOWN','title-match',0,0,0],
  ['doc_004','Sensorimotor learning across the adult lifespan','R. Ito, F. Ahmed & L. Berg','Cognitive Systems',2026,'PROCESSING','pending',0,0,0],
  ['doc_005','The role of rest in skill acquisition','S. Kim & N. Williams','Learning and Memory Studies',2023,'ACTIVE','doi-in-text',2,1,0],
  ['doc_006','Experience-dependent changes in functional connectivity','D. Silva, A. Roy & K. Jensen','Systems Neuroscience Review',2025,'ACTIVE','metadata-match',2,1,1],
  ['doc_007','A framework for measuring transfer of learning','E. Rossi & T. Nakamura','Methods in Cognitive Science',2024,'ACTIVE','doi-in-text',1,0,0],
  ['doc_008','Individual variability in perceptual learning','H. Ali, C. Martin & P. Zhou','Perception Research',2025,'ACTIVE','metadata-match',2,1,0],
  ['doc_009','Learning-related changes in attentional control','J. Cooper & I. Santos','Behavioral Research Letters',2022,'ACTIVE','doi-in-text',1,0,0],
  ['doc_010','Protocol for an adaptive working-memory intervention','B. Fischer & O. Mensah','Unconfirmed publication',2026,'UNKNOWN','unresolved',0,0,0],
  ['doc_011','Sleep architecture and memory reactivation','V. Desai & A. Holm','Cognitive Research Reports',2024,'ACTIVE','doi-in-text',2,1,0],
  ['doc_012','Practice schedules and retention of learned skills','N. Adler, P. Lewis & Y. Tan','Learning and Memory Studies',2023,'ACTIVE','doi-in-text',1,1,0],
];

function makeDoc(r: RawRecord, i: number): Document {
  const [id, title, authors, journal, year, status, method, claimCount, answers, summaries] = r;
  const hasNoDoi = status === 'UNKNOWN' || status === 'PROCESSING';
  const doi = hasNoDoi ? null : `10.0000/origyn.${year}.${String(i + 1).padStart(3, '0')}`;
  const retractionStatus =
    status === 'ACTIVE' ? 'NONE_FOUND' :
    status === 'RETRACTED' ? 'RETRACTED' : 'UNKNOWN';

  const base: Omit<Document, 'claims'> = {
    id,
    filename: title.toLowerCase().replaceAll(' ', '-') + '.pdf',
    title,
    doi,
    status,
    retractionStatus,
    retractionNotice: status === 'RETRACTED' ? RETRACTION_NOTICE : null,
    createdAt: '2026-09-12T09:20:00Z',
    updatedAt: '2026-09-18T08:40:00Z',
    authors,
    journal,
    year,
    identificationMethod: method,
    lastChecked: status === 'PROCESSING' ? null : '2026-09-18T08:40:00Z',
    usage: { claims: claimCount, answers, summaries },
    isMock: true,
  };

  return { ...base, claims: makeClaims(base as Document, claimCount) };
}

export const MOCK_DOCUMENTS: Document[] = RAW.map(makeDoc);

// ─── Recent activity ──────────────────────────────────────────────────────────
export const RECENT_ACTIVITY = [
  { id: 'e1', type: 'retracted', title: 'Retraction detected',              description: 'Neural adaptation following repeated cognitive training',  sourceId: 'doc_002', time: 'Today, 08:40' },
  { id: 'e2', type: 'unknown',   title: 'Source needs identification',       description: 'Longitudinal markers of cortical plasticity',             sourceId: 'doc_003', time: 'Today, 08:32' },
  { id: 'e3', type: 'claims',    title: '3 claims extracted',                description: 'Sleep-dependent consolidation of motor learning',         sourceId: 'doc_001', time: 'Today, 08:20' },
  { id: 'e4', type: 'upload',    title: 'Paper added to the workspace',      description: 'Sensorimotor learning across the adult lifespan',         sourceId: 'doc_004', time: 'Today, 08:12' },
];
