'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Clipboard write failed:', e)
    }
  }

  return (
    <button onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
      style={{ background: copied ? '#10B981' : '#8B5CF6', color: '#FFFFFF' }}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied to clipboard!' : 'Copy to clipboard'}
    </button>
  )
}
