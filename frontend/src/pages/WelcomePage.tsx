// pages/WelcomePage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Droplets, TrendingDown, Users, Bell, Globe, ChevronRight } from 'lucide-react'
import { saveSettings, exploreDemo } from '../store'
import type { UserRole, Language } from '../types'
import { t } from '../i18n'

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'society', label: 'Society Manager', desc: 'Managing borewell for a housing society' },
  { value: 'farm', label: 'Farmer', desc: 'Monitoring agricultural borewell' },
  { value: 'officer', label: 'Water Officer / Panchayat', desc: 'Official water monitoring role' },
  { value: 'ngo', label: 'NGO / Volunteer', desc: 'Community water awareness work' },
]

const LANGS: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
]

export function WelcomePage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('society')
  const [lang, setLang] = useState<Language>('en')

  const handleGetStarted = () => {
    saveSettings({ role, language: lang })
    navigate('/home')
  }

  const handleExploreDemo = () => {
    saveSettings({ role, language: lang })
    exploreDemo()
    navigate('/home')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Hero */}
      <div
        className="relative flex-1 flex flex-col items-center justify-center px-4 py-12 text-center
                   bg-gradient-to-b from-[#0B5C8A] to-[#0E8FA3] overflow-hidden"
        style={{ minHeight: '50vh' }}
      >
        {/* Contour lines background */}
        <svg className="absolute inset-0 w-full h-full opacity-10" preserveAspectRatio="none">
          {[0.1, 0.25, 0.4, 0.6, 0.75, 0.9].map((y, i) => (
            <path
              key={i}
              d={`M0,${y * 100}% Q25%,${(y - 0.05) * 100}% 50%,${(y + 0.03) * 100}% T100%,${y * 100}%`}
              stroke="white"
              strokeWidth="1"
              fill="none"
            />
          ))}
        </svg>

        <div className="relative z-10 max-w-lg mx-auto">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Droplets size={32} className="text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Borewell Ledger</h1>
          <p className="text-lg text-white/90 font-medium mb-2">{t('welcome.tagline', lang)}</p>
          <p className="text-white/70 text-sm">{t('welcome.subtitle', lang)}</p>
        </div>
      </div>

      {/* Value cards */}
      <div className="bg-[#F4F8FB] dark:bg-gray-800 py-8 px-4">
        <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { Icon: TrendingDown, title: 'Track', desc: 'Log borewell depth readings over time', color: '#0B5C8A' },
            { Icon: Users,        title: 'Compare', desc: 'See how your well compares to nearby wells', color: '#0E8FA3' },
            { Icon: Bell,         title: 'Act', desc: 'Get early warnings and water-saving advice', color: '#D97706' },
          ].map(({ Icon, title, desc, color }) => (
            <div key={title} className="card p-4 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                   style={{ background: `${color}20` }}>
                <Icon size={20} style={{ color }} aria-hidden />
              </div>
              <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-1">{title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
            </div>
          ))}
        </div>

        {/* Role selector */}
        <div className="max-w-lg mx-auto mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            I am a…
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                className={`p-3 rounded-lg border-2 text-left transition-colors min-h-[60px]
                  ${role === r.value
                    ? 'border-[#0B5C8A] bg-[#0B5C8A]/5 text-[#0B5C8A] dark:bg-blue-900/20 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                  }`}
                aria-pressed={role === r.value}
              >
                <div className="font-medium text-sm">{r.label}</div>
                <div className="text-xs opacity-70 mt-0.5">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Language picker */}
        <div className="max-w-lg mx-auto mb-8">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Language
          </label>
          <div className="flex gap-2">
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors min-h-[44px]
                  ${lang === l.code
                    ? 'border-[#0B5C8A] bg-[#0B5C8A] text-white'
                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                  }`}
                aria-pressed={lang === l.code}
              >
                {l.native}
              </button>
            ))}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="max-w-lg mx-auto flex flex-col sm:flex-row gap-3">
          <button onClick={handleGetStarted} className="btn-primary flex-1 justify-center">
            {t('action.get_started', lang)}
            <ChevronRight size={16} aria-hidden />
          </button>
          <button onClick={handleExploreDemo} className="btn-secondary flex-1 justify-center">
            {t('action.explore_demo', lang)}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          No account needed. Data stays on your device and in the community pool.
        </p>
      </div>
    </div>
  )
}
