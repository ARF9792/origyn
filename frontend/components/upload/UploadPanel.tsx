'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Icon } from '@/components/ui/Icon';
import { UploadDropzone } from './UploadDropzone';
import { AnalysisSteps } from './AnalysisSteps';

import { uploadDocument, extractClaims } from '@/lib/api';

import type { Document } from '@/lib/types';
import { DuplicateDocumentError } from '@/lib/types';

export function UploadPanel() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [result, setResult] = useState<Document | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const startUpload = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setDuplicateId(null);
    setResult(null);
    setStage(null);

    abortControllerRef.current = new AbortController();

    try {
      const doc = await uploadDocument(selectedFile, {
        signal: abortControllerRef.current.signal,
        onStage: setStage,
      });

      if (
        doc.status === 'ACTIVE' &&
        process.env.NEXT_PUBLIC_API_MODE === 'real'
      ) {
        // Auto-extract claims in background.
        extractClaims(doc.id).catch(() => {});
      }

      setResult(doc);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        resetState();
      } else if (
        err instanceof DuplicateDocumentError ||
        err.code === 'DUPLICATE_DOCUMENT'
      ) {
        setError('This paper is already in your workspace.');
        setDuplicateId(err.existingDocumentId);
      } else {
        setError(err.message || 'Upload failed');
      }
    } finally {
      abortControllerRef.current = null;
      setStage(null);
    }
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const resetState = () => {
    setFile(null);
    setStage(null);
    setError(null);
    setDuplicateId(null);
    setResult(null);
  };

  const isUploading = stage !== null;

  return (
    <div className="panel upload-page">
      <div className="dialog-header">
        <div>
          <h2>Add source to workspace</h2>

          <p>
            Upload a paper to extract its claims and check for retractions.
          </p>
        </div>
      </div>

      <div className="upload-body">
        {error ? (
          <div
            className="error-state panel e-state"
            role="alert"
          >
            <Icon name="warning" />

            <div>
              <h3>Upload failed</h3>

              <p>{error}</p>

              {duplicateId ? (
                <div className="dialog-actions">
                  <button
                    className="button compact quiet"
                    onClick={resetState}
                  >
                    Upload another
                  </button>

                  <button
                    className="button primary"
                    onClick={() =>
                      router.push(
                        `/workspace/sources/${encodeURIComponent(
                          duplicateId
                        )}`
                      )
                    }
                  >
                    View existing source
                  </button>
                </div>
              ) : (
                <button
                  className="button"
                  onClick={resetState}
                >
                  <Icon name="refresh" /> Retry
                </button>
              )}
            </div>
          </div>
        ) : result ? (
          <div
            className={`analysis-result ${result.status.toLowerCase()}`}
          >
            <div className="result-status">
              <span
                className={`status-badge ${result.status.toLowerCase()}`}
              >
                <Icon
                  name={
                    result.status === 'RETRACTED'
                      ? 'retracted'
                      : result.status === 'UNKNOWN'
                        ? 'unknown'
                        : 'circlecheck'
                  }
                />

                {result.status === 'ACTIVE'
                  ? 'No retraction found'
                  : result.status === 'RETRACTED'
                    ? 'Retracted'
                    : 'Unable to verify'}
              </span>
            </div>

            <h3>{result.title || result.filename}</h3>

            {result.authors && (
              <p>{result.authors}</p>
            )}

            <dl>
              <div>
                <dt>Identification</dt>
                <dd>{result.identificationMethod}</dd>
              </div>

              <div>
                <dt>Object identifier</dt>
                <dd>{result.doi || 'None'}</dd>
              </div>

              <div>
                <dt>Extracted claims</dt>
                <dd>{result.claims?.length || 0}</dd>
              </div>
            </dl>

            {result.status === 'RETRACTED' && (
              <div className="result-notice">
                <Icon name="warning" />

                <div>
                  <b>
                    Retraction or validity notice issued
                  </b>

                  <p>
                    Origyn found a retraction notice for this
                    source. Any extracted claims have been
                    marked as affected.
                  </p>
                </div>
              </div>
            )}

            {result.status === 'UNKNOWN' && (
              <div className="result-notice">
                <Icon name="unknown" />

                <div>
                  <b>Status could not be verified</b>

                  <p>
                    This source could not be definitively
                    matched to an authoritative metadata
                    record. It has not been checked for
                    retractions.
                  </p>
                </div>
              </div>
            )}

            <div
              className="dialog-actions"
              style={{ marginTop: '24px' }}
            >
              <button
                className="button compact quiet"
                onClick={resetState}
              >
                Upload another
              </button>

              <button
                className="button primary"
                onClick={() =>
                  router.push(
                    `/workspace/sources/${encodeURIComponent(
                      result.id
                    )}`
                  )
                }
              >
                View source detail
              </button>
            </div>
          </div>
        ) : isUploading && file ? (
          <div>
            <div className="processing-file">
              <Icon name="upload" />
              <span>{file.name}</span>
            </div>

            <div className="analysis-explanation">
              <h3>Processing document</h3>

              <p>
                Origyn is extracting scholarly metadata to
                query authoritative registries.
              </p>
            </div>

            <AnalysisSteps currentStageId={stage} />

            <div className="dialog-actions">
              <span className="caption">
                Please do not close this window.
              </span>

              <button
                className="button compact quiet"
                onClick={cancelUpload}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <UploadDropzone onFileSelect={startUpload} />
        )}
      </div>
    </div>
  );
}