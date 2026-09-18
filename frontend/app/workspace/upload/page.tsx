import React from 'react';
import { UploadPanel } from '@/components/upload/UploadPanel';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upload Source · Origyn Workspace',
};

export default function UploadRoute() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Workspace Library</span>
          <h1>Upload</h1>
          <p>Add new sources to your workspace library.</p>
        </div>
      </div>
      <UploadPanel />
    </>
  );
}
