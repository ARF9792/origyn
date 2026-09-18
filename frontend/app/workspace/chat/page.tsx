import React from 'react';
import type { Metadata } from 'next';
import { ChatController } from './ChatController';
import '@/styles/chat.css';

export const metadata: Metadata = {
  title: 'Chat · Origyn Workspace',
};

export default function ChatPage() {
  return <ChatController />;
}
