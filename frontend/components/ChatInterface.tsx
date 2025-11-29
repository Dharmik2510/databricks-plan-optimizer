import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Lock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { client } from '../api';
import { ChatMessage, AnalysisResult } from '../../shared/types';

interface Props {
  analysisResult: AnalysisResult | null;
}

export const ChatInterface: React.FC<Props> = ({ analysisResult }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: 'I have analyzed your DAG.\n\n**Ask me anything about:**\n- Specific stages (e.g., "Why is Stage 2 spilling?")\n- Join strategies (e.g., "Should I use Broadcast Join?")\n- Code refactoring tips.', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !analysisResult) return;
    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const responseText = await client.chat(userMsg.content);
      const aiMsg: ChatMessage = { role: 'ai', content: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error connecting to the consultant agent.", timestamp: Date.now() }]);
    } finally { setLoading(false); }
  };

  if (!analysisResult) {
    return (
        <div className="flex flex-col h-[650px] bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in relative justify-center items-center">
             <div className="text-center p-8 max-w-md">
                 <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-200"><Lock className="w-10 h-10 text-slate-400" /></div>
                 <h3 className="text-xl font-bold text-slate-900 mb-3">Consultant Unavailable</h3>
                 <p className="text-slate-600 mb-6 font-medium">AI Consultant requires an active analysis context to answer questions. Please run an analysis in the Plan Analyzer first.</p>
                 <div className="text-xs text-slate-500 font-mono bg-slate-50 p-3 rounded-lg border border-slate-200">Tip: Go to "Plan Analyzer" -> "New" -> Upload your execution plan.</div>
             </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-[650px] bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in relative">
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div><h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg"><Bot className="w-6 h-6 text-orange-600" />AI Performance Consultant</h3>
          <div className="flex items-center gap-2 mt-1"><span className="flex h-2 w-2 rounded-full bg-emerald-500"></span><span className="text-xs text-emerald-800 font-bold uppercase tracking-wider">Context Active: Plan Analysis Linked</span></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-white">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm border ${msg.role === 'ai' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {msg.role === 'ai' ? <Bot className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div className={`max-w-[85%] rounded-2xl p-5 text-sm shadow-sm border ${msg.role === 'user' ? 'bg-orange-600 text-white border-orange-600 rounded-tr-sm font-medium' : 'bg-slate-50 text-slate-900 border-slate-200 rounded-tl-sm font-medium'}`}>
              {msg.role === 'ai' ? (<div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-200 prose-pre:text-slate-900 prose-strong:text-slate-900"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>) : (<p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>)}
            </div>
          </div>
        ))}
        {loading && <div className="flex gap-4"><div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mt-1 border border-slate-200 shadow-sm"><Bot className="w-6 h-6 text-orange-600" /></div><div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm p-5 flex items-center gap-1.5 shadow-sm"><div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div></div></div>}
        <div ref={bottomRef} />
      </div>
      <div className="p-5 bg-slate-50 border-t border-slate-200">
        <div className="relative"><input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask about Z-Ordering, Join strategies..." className="w-full pl-6 pr-14 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-slate-900 placeholder-slate-400 shadow-sm font-medium" /><button onClick={handleSend} disabled={!input.trim() || loading} className="absolute right-3 top-3 p-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:hover:bg-orange-600 transition-colors shadow-sm"><Send className="w-4 h-4" /></button></div>
      </div>
    </div>
  );
};