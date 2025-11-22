
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
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
    <div className="flex flex-col h-[650px] bg-white/70 backdrop-blur-2xl rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden animate-fade-in relative">
      
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
            <Bot className="w-6 h-6 text-orange-500" />
            AI Performance Consultant
          </h3>
          <p className="text-xs text-slate-500 mt-1">Interactive debugging session.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-slate-50/30">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm border ${
              msg.role === 'ai' 
              ? 'bg-white text-orange-500 border-slate-200' 
              : 'bg-slate-200 text-slate-600 border-slate-300'
            }`}>
              {msg.role === 'ai' ? <Bot className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div className={`max-w-[85%] rounded-2xl p-5 text-sm shadow-sm border ${
              msg.role === 'user' 
                ? 'bg-orange-600 text-white border-orange-700 rounded-tr-sm' 
                : 'bg-white text-slate-800 border-slate-200 rounded-tl-sm'
            }`}>
              {msg.role === 'ai' ? (
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:text-slate-800">
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
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mt-1 border border-slate-200 shadow-sm">
              <Bot className="w-6 h-6 text-orange-500" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-5 flex items-center gap-1.5 shadow-sm">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms'}}></div>
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms'}}></div>
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms'}}></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-5 bg-white border-t border-slate-200">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about Z-Ordering, Join strategies..."
            className="w-full pl-6 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400 shadow-inner"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-3 top-3 p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:hover:bg-orange-600 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
