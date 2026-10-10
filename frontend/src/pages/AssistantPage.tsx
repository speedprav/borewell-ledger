// pages/AssistantPage.tsx
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Send, Bot, Copy, ThumbsUp, ThumbsDown, Leaf } from 'lucide-react'
import { aiChat, getMap } from '../api'
import { getSettings, getChatHistory, saveChatHistory } from '../store'
import { CardSkeleton } from '../components/Skeleton'
import type { ChatMessage, Well } from '../types'

const SUGGESTIONS = [
  'How is my borewell doing?',
  'What could cause rapid decline?',
  'How do I save water?',
  'What does the decline rate mean?',
  'How accurate is this data?',
  'When should I get a professional assessment?',
]

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#0B5C8A] flex items-center justify-center mr-2 shrink-0 mt-1">
          <Bot size={14} className="text-white" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? 'bg-[#0B5C8A] text-white rounded-tr-sm'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'
        }`}
      >
        {msg.content}
      </div>
    </div>
  )
}

export function AssistantPage() {
  const [searchParams] = useSearchParams()
  const wellIdParam = searchParams.get('wellId')
  const navigate = useNavigate()
  const settings = getSettings()
  const lang = settings.language
  const [wells, setWells] = useState<Well[]>([])
  const [selectedWellId, setSelectedWellId] = useState<string | null>(wellIdParam)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sources, setSources] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getMap().then(data => setWells(data.wells)).catch(() => {})
    const history = getChatHistory(selectedWellId)
    if (history.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Hi! I\'m your groundwater assistant. I can help you understand borewell trends, compare with nearby wells, and suggest water-saving steps. Select a well for specific analysis, or ask me anything.'
      }])
    } else {
      setMessages(history as ChatMessage[])
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const content = text || input.trim()
    if (!content || loading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const resp = await aiChat(newMessages, selectedWellId, lang)
      const withReply: ChatMessage[] = [...newMessages, { role: 'assistant', content: resp.reply }]
      setMessages(withReply)
      setSources(resp.sources)
      saveChatHistory(selectedWellId, withReply)
    } catch {
      const withErr: ChatMessage[] = [...newMessages, {
        role: 'assistant',
        content: 'Sorry, I couldn\'t connect. Please check your connection and try again.'
      }]
      setMessages(withErr)
    } finally {
      setLoading(false)
    }
  }

  const selectedWell = wells.find(w => w.wellId === selectedWellId)

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] md:h-[calc(100vh-56px)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <Bot size={18} className="text-[#0B5C8A]" />
          <h1 className="font-semibold text-gray-800 dark:text-gray-200">AI Assistant</h1>
        </div>
        <select
          value={selectedWellId || ''}
          onChange={e => setSelectedWellId(e.target.value || null)}
          className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          aria-label="Select well for context"
        >
          <option value="">All my wells (general)</option>
          {wells.map(w => (
            <option key={w.wellId} value={w.wellId}>
              {w.name} ({w.locality})
            </option>
          ))}
        </select>
        {selectedWell && (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
            <span className="bg-[#0B5C8A]/10 text-[#0B5C8A] rounded px-1.5 py-0.5">
              {selectedWell.latestDepthM ? `${selectedWell.latestDepthM.toFixed(1)} m` : '—'}
            </span>
            <span className="bg-[#0B5C8A]/10 text-[#0B5C8A] rounded px-1.5 py-0.5">
              {selectedWell.slopeMPerMonth ? `${selectedWell.slopeMPerMonth.toFixed(2)} m/mo` : '—'}
            </span>
            <span className="bg-[#0B5C8A]/10 text-[#0B5C8A] rounded px-1.5 py-0.5">
              {selectedWell.status}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite" aria-label="Chat messages">
        {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="w-7 h-7 rounded-full bg-[#0B5C8A] flex items-center justify-center mr-2 shrink-0 mt-1">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-white dark:bg-gray-800 border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                       style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        {sources && messages.length > 1 && (
          <p className="text-xs text-center text-gray-400 my-2">
            Based on: {sources.readingsUsed} reading{sources.readingsUsed !== 1 ? 's' : ''}, {sources.peersUsed} nearby well{sources.peersUsed !== 1 ? 's' : ''}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              className="shrink-0 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                         px-3 py-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 whitespace-nowrap min-h-[36px]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about your borewell…"
            className="flex-1 p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700"
            aria-label="Chat input"
            disabled={loading}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="btn-primary px-3 py-2"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          AI assistance only. Not a substitute for professional hydrogeology advice.
        </p>
      </div>
    </div>
  )
}
