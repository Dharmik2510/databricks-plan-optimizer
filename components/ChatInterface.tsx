import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendChatMessage } from '../services/geminiService';
import { ChatMessage } from '../types';

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: 'I have analyzed your DAG.\n\n**Ask me anything about:**\n- Specific stages (e.g., "Why is Stage 2 spilling?")\n- Join strategies (e.g., "Should I use Broadcast Join?")\n- Code refactoring tips.', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const responseText = await sendChatMessage(userMsg.content);
      const aiMsg: ChatMessage = { role: 'ai', content: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error connecting to the consultant agent.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[650px] bg-slate-900/40 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden animate-fade-in relative">
      {/* Gloss Shine */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

      <div className="p-5 border-b border-white/10 bg-white/5 flex justify-between items-center backdrop-blur-md">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2 text-lg drop-shadow-sm">
            <Bot className="w-6 h-6 text-indigo-400" />
            AI Performance Consultant
          </h3>
          <p className="text-xs text-slate-300 mt-1">Interactive debugging session.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-black/10">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-lg border border-white/10 ${
              msg.role === 'ai' 
              ? 'bg-indigo-500/20 text-indigo-300 backdrop-blur-md' 
              : 'bg-slate-700/40 text-slate-300 backdrop-blur-md'
            }`}>
              {msg.role === 'ai' ? <Bot className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div className={`max-w-[85%] rounded-3xl p-5 text-sm shadow-lg backdrop-blur-lg border ${
              msg.role === 'user' 
                ? 'bg-indigo-600/80 border-indigo-500/50 text-white rounded-tr-sm' 
                : 'bg-slate-800/60 border-white/10 text-slate-100 rounded-tl-sm'
            }`}>
              {msg.role === 'ai' ? (
                <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:backdrop-blur-sm">
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
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center mt-1 border border-white/10">
              <Bot className="w-6 h-6 text-indigo-300" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl rounded-tl-sm p-5 flex items-center gap-1.5 shadow-lg backdrop-blur-md">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms'}}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms'}}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms'}}></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-5 bg-white/5 border-t border-white/10 backdrop-blur-md">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about Z-Ordering, Join strategies..."
            className="w-full pl-6 pr-14 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:bg-black/50 transition-all text-white placeholder-slate-400 shadow-inner backdrop-blur-sm"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-3 top-3 p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};