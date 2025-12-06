// src/hooks/useChat.ts
// Hook for managing chat operations

import { useState, useCallback } from 'react';
import { chatApi, ChatSession, ChatMessage, CreateSessionData } from '../api';

interface UseChatReturn {
  // State
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  // Actions
  createSession: (data?: CreateSessionData) => Promise<ChatSession>;
  fetchSessions: () => Promise<void>;
  fetchSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearError: () => void;
  setCurrentSession: (session: ChatSession | null) => void;
}

export function useChat(): UseChatReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(async (data?: CreateSessionData): Promise<ChatSession> => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await chatApi.createSession(data);
      setCurrentSession(session);
      setMessages(session.messages || []);
      setSessions(prev => [session, ...prev]);
      return session;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create chat session';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionList = await chatApi.listSessions();
      setSessions(sessionList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch chat sessions';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSession = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await chatApi.getSession(id);
      setCurrentSession(session);
      setMessages(session.messages || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch chat session';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!currentSession) {
      setError('No active chat session');
      return;
    }

    setIsSending(true);
    setError(null);

    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await chatApi.sendMessage(currentSession.id, content);
      
      // Replace temp message with real ones
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMessage.id),
        response.userMessage,
        response.assistantMessage,
      ]);

      // Update session in list
      setSessions(prev => 
        prev.map(s => 
          s.id === currentSession.id 
            ? { ...s, messageCount: s.messageCount + 2, updatedAt: new Date().toISOString() }
            : s
        )
      );
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
      throw err;
    } finally {
      setIsSending(false);
    }
  }, [currentSession]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await chatApi.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSession?.id === id) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      setError(message);
      throw err;
    }
  }, [currentSession]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    sessions,
    currentSession,
    messages,
    isLoading,
    isSending,
    error,
    createSession,
    fetchSessions,
    fetchSession,
    sendMessage,
    deleteSession,
    clearError,
    setCurrentSession,
  };
}

export default useChat;
