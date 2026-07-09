'use client'
import { useState, useRef, useEffect, useLayoutEffect, type CSSProperties } from 'react'

export interface ComboboxOption { value: string; label: string; sub?: string }

interface Props {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** When true, typed text that matches no option is accepted as the value itself on
   * blur/enter (e.g. a free-text product name not yet in the master list). When false
   * (default), the field always resolves back to a valid option or empty — used for
   * foreign-key-style selections like an influencer id. */
  allowFreeText?: boolean
  /** Label for a leading "clear selection" option, e.g. "— Tidak ada —". Omit to skip it. */
  emptyLabel?: string
}

const inputStyle: CSSProperties = {
  width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8,
  border: '1px solid #E5E7EB', color: '#111827', outline: 'none', boxSizing: 'border-box',
}

/** Searchable dropdown: type to filter `options` by label, click one to select. With
 * `allowFreeText`, typed text that matches nothing is kept as-is instead of reverting. */
export default function SearchableCombobox({ options, value, onChange, placeholder, allowFreeText = false, emptyLabel }: Props) {
  const selected = options.find(o => o.value === value)
  // Only meaningful while `open` — the displayed value falls back to the committed
  // `value`/`selected` directly (below) whenever closed, and `onFocus`/`pick`/
  // `commitAndClose` already (re)seed this whenever a fresh edit starts.
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  function commitAndClose() {
    // Guard on `open`: the click-outside handler below fires on EVERY mousedown anywhere
    // else on the page, including totally unrelated ones (e.g. clicking "Simpan"). Without
    // this guard, a field that was never focused this render still has query='' from its
    // initial state, and '' !== value would look like "the user cleared it" and silently
    // wipe an existing free-text value on every unrelated click on the page.
    if (!open) return
    setOpen(false)
    if (allowFreeText) {
      if (query.trim() !== value) onChange(query.trim())
    } else {
      // Must resolve to a real option (or empty) — revert the visible text if the user
      // typed something that doesn't match anything and didn't click an option.
      setQuery(selected ? selected.label : '')
    }
  }

  // The document listener is registered once (mount) but must always run the LATEST
  // commitAndClose — that closure captures `query`/`value`, which change on every
  // keystroke. Without this ref, a stale mount-time closure with query='' would silently
  // drop a just-typed free-text value (or wipe an existing one to '') on every
  // click-outside commit, since '' !== value is a false positive for "user changed it".
  const commitRef = useRef(commitAndClose)
  // Keep the ref pointing at the latest closure without re-subscribing the mousedown
  // listener below. useLayoutEffect runs synchronously after every render (before the
  // browser can paint or an event can fire), so the ref is always fresh — same pattern
  // as useRealtimeSync.ts's onChangeRef.
  useLayoutEffect(() => {
    commitRef.current = commitAndClose
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) commitRef.current()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o =>
    !query.trim() || o.label.toLowerCase().includes(query.trim().toLowerCase()) || o.sub?.toLowerCase().includes(query.trim().toLowerCase())
  )

  function pick(v: string, label: string) {
    onChange(v)
    setQuery(label)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        value={open ? query : (selected ? selected.label : (allowFreeText ? value : ''))}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => { setQuery(selected ? selected.label : (allowFreeText ? value : '')); setOpen(true) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitAndClose() } if (e.key === 'Escape') commitAndClose() }}
        placeholder={placeholder}
        style={inputStyle}
      />
      {open && (filtered.length > 0 || emptyLabel) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 30,
          background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 220, overflowY: 'auto',
        }}>
          {emptyLabel && (
            <div
              onMouseDown={e => { e.preventDefault(); pick('', '') }}
              style={{ padding: '7px 10px', fontSize: 13, cursor: 'pointer', color: '#6B7280' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {emptyLabel}
            </div>
          )}
          {filtered.map(o => (
            <div
              key={o.value}
              onMouseDown={e => { e.preventDefault(); pick(o.value, o.label) }}
              style={{ padding: '7px 10px', fontSize: 13, cursor: 'pointer', color: '#111827' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {o.label}
            </div>
          ))}
          {filtered.length === 0 && !emptyLabel && (
            <div style={{ padding: '7px 10px', fontSize: 12, color: '#9CA3AF' }}>
              {allowFreeText ? 'Tidak ada yang cocok — akan disimpan sebagai teks baru' : 'Tidak ada yang cocok'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
