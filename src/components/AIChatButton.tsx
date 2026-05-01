'use client'
import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, Loader2, ChevronDown } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Context {
  currentView: string
  brand: string
  timeframe: string | number
  hasData: Record<string, boolean>
  productCount: number
  bundleCount: number
}

interface Props {
  context: Context
}

const WELCOME = 'Halo! Gue AI Support-nya SAS Dashboard. Temuin bug atau ada yang bingung? Ceritain aja — gue bantu diagnosa.'

export default function AIChatButton({ context }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setUnread(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context }),
      })
      const data = await res.json()
      const reply = data.reply || 'Maaf, ada error. Coba lagi ya.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      if (!open) setUnread(true)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Koneksi error. Coba lagi.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{ width: 360, height: 500, background: '#FFFFFF', border: '1px solid #E5E7EB' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ background: '#111827', borderBottom: '1px solid #1F2937' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.3)' }}>
                <Bot size={14} style={{ color: '#A78BFA' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#F9FAFB' }}>AI Support</p>
                <p className="text-[10px]" style={{ color: '#6B7280' }}>SAS Dashboard · powered by Claude</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ color: '#6B7280' }}>
              <ChevronDown size={18} />
            </button>
          </div>

          {/* Context pill */}
          <div className="px-4 py-2 flex-shrink-0" style={{ background: '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#E5E7EB', color: '#6B7280' }}>
                📍 {context.currentView}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#E5E7EB', color: '#6B7280' }}>
                🏷 {context.brand}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#E5E7EB', color: '#6B7280' }}>
                ⏱ {context.timeframe}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Welcome message */}
            <div className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(139,92,246,0.15)' }}>
                <Bot size={12} style={{ color: '#8B5CF6' }} />
              </div>
              <div className="rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%]" style={{ background: '#F3F4F6' }}>
                <p className="text-xs leading-relaxed" style={{ color: '#374151' }}>{WELCOME}</p>
              </div>
            </div>

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 items-start ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(139,92,246,0.15)' }}>
                    <Bot size={12} style={{ color: '#8B5CF6' }} />
                  </div>
                )}
                <div className="rounded-2xl px-3 py-2 max-w-[85%]"
                  style={{
                    background: m.role === 'user' ? '#8B5CF6' : '#F3F4F6',
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  }}>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: m.role === 'user' ? '#FFFFFF' : '#374151' }}>
                    {m.content}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,92,246,0.15)' }}>
                  <Bot size={12} style={{ color: '#8B5CF6' }} />
                </div>
                <div className="rounded-2xl px-3 py-2.5" style={{ background: '#F3F4F6' }}>
                  <Loader2 size={14} className="animate-spin" style={{ color: '#8B5CF6' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Ceritain masalahnya..."
                className="flex-1 text-xs outline-none bg-transparent"
                style={{ color: '#111827' }} />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
                style={{ background: '#8B5CF6' }}>
                <Send size={12} style={{ color: '#FFFFFF' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all"
        style={{
          background: open ? '#1F2937' : '#8B5CF6',
          boxShadow: open ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(139,92,246,0.5)',
          transform: 'scale(1)',
        }}>
        {open
          ? <X size={20} style={{ color: '#FFFFFF' }} />
          : <Bot size={22} style={{ color: '#FFFFFF' }} />
        }
        {unread && !open && (
          <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: '#EF4444' }} />
        )}
      </button>
    </>
  )
}
