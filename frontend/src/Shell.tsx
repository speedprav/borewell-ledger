// Shell.tsx - App shell with sidebar (desktop) and bottom tab bar (mobile)
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  Home, Map, Plus, Droplets, Bell, Bot, Leaf,
  Users, Settings, Info, Moon, Sun, Globe, ChevronDown
} from 'lucide-react'
import { getSettings, saveSettings, applyTheme } from './store'
import { getAlerts } from './api'
import { OfflineBanner } from './components/OfflineBanner'
import { t } from './i18n'
import type { Language, Theme } from './types'

const NAV_ITEMS = [
  { to: '/home',      Icon: Home,     key: 'nav.home' },
  { to: '/map',       Icon: Map,      key: 'nav.map' },
  { to: '/wells',     Icon: Droplets, key: 'nav.wells' },
  { to: '/alerts',    Icon: Bell,     key: 'nav.alerts' },
  { to: '/assistant', Icon: Bot,      key: 'nav.assistant' },
  { to: '/plan',      Icon: Leaf,     key: 'nav.plan' },
  { to: '/community', Icon: Users,    key: 'nav.community' },
  { to: '/settings',  Icon: Settings, key: 'nav.settings' },
  { to: '/about',     Icon: Info,     key: 'nav.about' },
]

const BOTTOM_TABS = [
  { to: '/home',      Icon: Home,     key: 'nav.home' },
  { to: '/map',       Icon: Map,      key: 'nav.map' },
  { to: '/add',       Icon: Plus,     key: 'nav.add', primary: true },
  { to: '/assistant', Icon: Bot,      key: 'nav.assistant' },
  { to: '/wells',     Icon: Droplets, key: 'nav.wells' },
]

export function Shell() {
  const [settings, setSettings] = useState(getSettings())
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [langOpen, setLangOpen] = useState(false)
  const navigate = useNavigate()
  const lang = settings.language

  useEffect(() => {
    getAlerts({ status: 'new' }).then(data => {
      setUnreadAlerts(data.alerts.length)
    }).catch(() => {})
  }, [])

  const toggleTheme = () => {
    const newTheme: Theme = settings.theme === 'dark' ? 'light' : 'dark'
    applyTheme(newTheme)
    const updated = saveSettings({ theme: newTheme })
    setSettings(updated)
  }

  const setLang = (l: Language) => {
    const updated = saveSettings({ language: l })
    setSettings(updated)
    setLangOpen(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F8FB] dark:bg-gray-900">
      <OfflineBanner lang={lang} />

      {/* Top bar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="flex items-center h-14 px-4 gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 mr-auto cursor-pointer" onClick={() => navigate('/home')}>
            <div className="w-8 h-8 rounded-lg bg-[#0B5C8A] flex items-center justify-center">
              <Droplets size={18} className="text-white" />
            </div>
            <span className="font-bold text-[#0B5C8A] dark:text-blue-400 text-sm hidden sm:block">
              Borewell Ledger
            </span>
          </div>

          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(o => !o)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300
                         hover:bg-gray-100 dark:hover:bg-gray-700 min-h-[36px]"
              aria-label="Change language"
              aria-expanded={langOpen}
            >
              <Globe size={16} aria-hidden />
              <span className="hidden sm:inline">
                {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'ગુજરાતી'}
              </span>
              <span className="sm:hidden text-xs font-medium">
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'HI' : 'GU'}
              </span>
              <ChevronDown size={14} aria-hidden />
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg
                              border border-gray-200 dark:border-gray-700 z-50">
                {[
                  { code: 'en', label: 'English' },
                  { code: 'hi', label: 'हिन्दी' },
                  { code: 'gu', label: 'ગુજરાતી' },
                ].map(({ code, label }) => (
                  <button
                    key={code}
                    onClick={() => setLang(code as Language)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700
                                ${lang === code ? 'font-semibold text-[#0B5C8A] dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Alerts bell */}
          <NavLink
            to="/alerts"
            className="relative flex items-center justify-center w-10 h-10 rounded-lg
                       hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            aria-label={`Alerts${unreadAlerts > 0 ? `, ${unreadAlerts} new` : ''}`}
          >
            <Bell size={20} aria-hidden />
            {unreadAlerts > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px]
                               rounded-full flex items-center justify-center font-bold">
                {unreadAlerts > 9 ? '9+' : unreadAlerts}
              </span>
            )}
          </NavLink>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-10 h-10 rounded-lg
                       hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            aria-label={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {settings.theme === 'dark' ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <nav
          className="hidden md:flex flex-col w-56 bg-white dark:bg-gray-800
                     border-r border-gray-200 dark:border-gray-700 shrink-0 overflow-y-auto"
          aria-label="Main navigation"
        >
          <div className="py-4 px-3 space-y-1">
            {NAV_ITEMS.map(({ to, Icon, key }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]
                  ${isActive
                    ? 'bg-[#0B5C8A] text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                <Icon size={18} aria-hidden />
                {t(key, lang)}
                {key === 'nav.alerts' && unreadAlerts > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {unreadAlerts}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0" id="main-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800
                   border-t border-gray-200 dark:border-gray-700 z-40"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {BOTTOM_TABS.map(({ to, Icon, key, primary }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                primary
                  ? `flex flex-col items-center justify-center w-14 h-14 rounded-full
                     ${isActive ? 'bg-[#094a70]' : 'bg-[#0B5C8A]'} text-white shadow-lg -mt-4`
                  : `flex flex-col items-center gap-0.5 px-3 py-1 min-w-[44px] min-h-[44px] rounded-lg
                     ${isActive
                       ? 'text-[#0B5C8A] dark:text-blue-400'
                       : 'text-gray-500 dark:text-gray-400'
                     }`
              }
              aria-label={t(key, lang)}
            >
              <Icon size={primary ? 24 : 20} aria-hidden />
              {!primary && (
                <span className="text-[10px] font-medium leading-none">
                  {t(key, lang).split(' ')[0]}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Click outside to close lang dropdown */}
      {langOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setLangOpen(false)} aria-hidden />
      )}
    </div>
  )
}
