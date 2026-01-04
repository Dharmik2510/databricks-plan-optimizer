import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Lock, Activity, History, ChevronDown, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatApi, ChatSession } from '../api/chat';
import { client } from '../api';
import { ChatMessage as UiChatMessage, AnalysisResult } from '../../shared/types';

interface Props {
  analysisResult: AnalysisResult | null;
}

interface LinkedAnalysis {
  id: string;
  title: string;
  createdAt: string;
}

export const ChatInterface: React.FC<Props> = ({ analysisResult }) => {
  const [messages, setMessages] = useState<UiChatMessage[]>([
    { role: 'ai', content: 'I have analyzed your DAG.\n\n**Ask me anything about:**\n- Specific stages (e.g., "Why is Stage 2 spilling?")\n- Join strategies (e.g., "Should I use Broadcast Join?")\n- Code refactoring tips.', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Context Management
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [activeAnalysisTitle, setActiveAnalysisTitle] = useState<string>('Loading...');
  const [recentAnalyses, setRecentAnalyses] = useState<LinkedAnalysis[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showContextSelector, setShowContextSelector] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 1. Initial Load & Sync with Props
  useEffect(() => {
    const initialize = async () => {
      // If prop provided (e.g. fresh analysis), force use it
      if (analysisResult) {
        setActiveAnalysisId(analysisResult.id);
        setActiveAnalysisTitle(analysisResult.title || 'Current Analysis');
        setIsInitializing(false);
        return;
      }

      // Otherwise, fetch recent to find a context
      try {
        const recents = await client.get('/analyses/recent') as any[]; // Assuming generic client
        if (recents && recents.length > 0) {
          const latest = recents[0];
          setRecentAnalyses(recents.map(r => ({ id: r.id, title: r.title, createdAt: r.createdAt })));

          // Only auto-set if we don't have one yet
          if (!activeAnalysisId) {
            setActiveAnalysisId(latest.id);
            setActiveAnalysisTitle(latest.title);
          }
        } else {
          setActiveAnalysisTitle('No Analysis Found');
        }
      } catch (e) {
        console.error("Failed to load recent analyses", e);
      } finally {
        setIsInitializing(false);
      }
    };
    initialize();
  }, [analysisResult]); // Re-run if prop changes (new analysis run)

  // 2. Init Chat Session when Active ID changes
  useEffect(() => {
    if (!activeAnalysisId) return;

    const initSession = async () => {
      setLoading(true);
      try {
        // Create (or get) session for this analysis
        const session = await chatApi.createSession({
          analysisId: activeAnalysisId,
          title: `Chat: ${activeAnalysisTitle}`
        });
        setSessionId(session.id);

        // Load history if any
        setMessages([
          {
            role: 'ai',
            content: `**Context Loaded: ${activeAnalysisTitle}**\nI'm ready to answer questions about this specific execution plan.`,
            timestamp: Date.now()
          }
        ]);
      } catch (error) {
        console.error("Failed to init chat session", error);
      } finally {
        setLoading(false);
      }
    };
    initSession();
  }, [activeAnalysisId, activeAnalysisTitle]);


  const handleSend = async () => {
    if (!input.trim() || !sessionId) return;

    // Optimistic UI update
    const userMsg: UiChatMessage = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await chatApi.sendMessage(sessionId, userMsg.content);

      const aiResponseContent = response.assistantMessage?.content || "No response received.";

      const aiMsg: UiChatMessage = {
        role: 'ai',
        content: aiResponseContent,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error connecting to the agent.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const switchContext = (id: string, title: string) => {
    setActiveAnalysisId(id);
    setActiveAnalysisTitle(title);
    setShowContextSelector(false);
  };

  // Loading Skeleton
  if (isInitializing) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)] lg:h-[650px] bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative z-20 animate-pulse">
        <div className="p-4 border-b border-slate-200 bg-slate-50 h-16"></div>
        <div className="flex-1 p-6 space-y-4">
          <div className="h-10 w-2/3 bg-slate-100 rounded-full"></div>
          <div className="h-10 w-1/2 bg-slate-100 rounded-full self-end ml-auto"></div>
        </div>
      </div>
    );
  }

  if (!activeAnalysisId && !loading && !analysisResult) {
    // Only show empty state if significantly failed to load anything
    return (
      <div className="flex flex-col h-[650px] bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in relative justify-center items-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-200">
            <Bot className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">Consultant Ready</h3>
          <p className="text-slate-600 mb-6 font-medium">Please run your first analysis to give me context.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] lg:h-[650px] bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in relative z-20">

      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
            <Bot className="w-6 h-6 text-orange-600" />
            AI Consultant
          </h3>

          {/* Context Selector */}
          <div className="relative">
            <button
              onClick={() => setShowContextSelector(!showContextSelector)}
              className="flex items-center gap-2 text-xs font-medium bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all shadow-sm"
            >
              <History className="w-3.5 h-3.5" />
              <span className="max-w-[150px] truncate">{activeAnalysisTitle}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </button>

            {showContextSelector && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowContextSelector(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-20 overflow-hidden text-left flex flex-col animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-3 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                    Switch Context
                  </div>
                  <div className="max-h-[300px] overflow-y-auto section-scrollbar">
                    {recentAnalyses.length === 0 && (
                      <div className="p-4 text-xs text-slate-400 text-center">No recent history</div>
                    )}
                    {recentAnalyses.map(a => (
                      <button
                        key={a.id}
                        onClick={() => switchContext(a.id, a.title)}
                        className={`w-full text-left p-3 text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between group ${activeAnalysisId === a.id ? 'bg-orange-50 hover:bg-orange-50' : ''
                          }`}
                      >
                        <span className={`truncate ${activeAnalysisId === a.id ? 'text-orange-700 font-medium' : 'text-slate-700'}`}>
                          {a.title}
                        </span>
                        {activeAnalysisId === a.id && <Check className="w-3.5 h-3.5 text-orange-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
            Connected: {activeAnalysisTitle}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-white">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm border ${msg.role === 'ai'
              ? 'bg-orange-50 text-orange-600 border-orange-100'
              : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
              {msg.role === 'ai' ? <Bot className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div className={`max-w-[85%] rounded-2xl p-5 text-sm shadow-sm border ${msg.role === 'user'
              ? 'bg-orange-600 text-white border-orange-600 rounded-tr-sm font-medium'
              : 'bg-slate-50 text-slate-900 border-slate-200 rounded-tl-sm font-medium'
              }`}>
              {msg.role === 'ai' ? (
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-200 prose-pre:text-slate-900 prose-strong:text-slate-900">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mt-1 border border-slate-200 shadow-sm">
              <Bot className="w-6 h-6 text-orange-600" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm p-5 flex items-center gap-1.5 shadow-sm">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-5 bg-slate-50 border-t border-slate-200">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Ask about ${activeAnalysisTitle.length > 20 ? 'analysis' : activeAnalysisTitle}...`}
            className="w-full pl-6 pr-14 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-slate-900 placeholder-slate-400 shadow-sm font-medium"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-3 top-3 p-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:hover:bg-orange-600 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
