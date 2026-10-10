// pages/SettingsPage.tsx
import { useState } from 'react'
import { getSettings, saveSettings, applyTheme } from '../store'
import { showToast } from '../components/Toast'
import type { UserRole, Language, Theme } from '../types'

export function SettingsPage() {
  const [settings, setSettings] = useState(getSettings())

  const update = (partial: Partial<typeof settings>) => {
    const updated = saveSettings(partial)
    setSettings(updated)
    if (partial.theme) applyTheme(partial.theme as Theme)
  }

  const clearData = () => {
    if (confirm('Clear all local data? This will remove followed wells, completed measures and chat history.')) {
      try { localStorage.clear() } catch {}
      showToast('Local data cleared', 'success')
      setSettings(getSettings())
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Settings</h1>

      {/* Profile */}
      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Profile</h2>
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-500">Name (optional)</label>
          <input
            type="text"
            value={settings.name}
            onChange={e => update({ name: e.target.value })}
            placeholder="Your name"
            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
            maxLength={80}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-500">Role</label>
          <select
            value={settings.role}
            onChange={e => update({ role: e.target.value as UserRole })}
            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="society">Society Manager</option>
            <option value="farm">Farmer</option>
            <option value="officer">Water Officer / Panchayat</option>
            <option value="ngo">NGO / Volunteer</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-500">Locality</label>
          <input
            type="text"
            value={settings.locality}
            onChange={e => update({ locality: e.target.value })}
            placeholder="e.g. Alkapuri"
            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          />
        </div>
      </section>

      {/* Display */}
      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Display</h2>
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-500">Language</label>
          <select
            value={settings.language}
            onChange={e => update({ language: e.target.value as Language })}
            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="gu">ગુજરાતી (Gujarati)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-500">Theme</label>
          <select
            value={settings.theme}
            onChange={e => update({ theme: e.target.value as Theme })}
            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-500">Units</label>
          <select
            value={settings.useFt ? 'ft' : 'm'}
            onChange={e => update({ useFt: e.target.value === 'ft' })}
            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="m">Metres (m)</option>
            <option value="ft">Feet (ft)</option>
          </select>
        </div>
      </section>

      {/* AI */}
      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Preferences</h2>
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-500">AI reply language</label>
          <select
            value={settings.aiLanguage}
            onChange={e => update({ aiLanguage: e.target.value as Language })}
            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="gu">ગુજરાતી</option>
          </select>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.allowAiData}
            onChange={e => update({ allowAiData: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Allow AI to use my well data
          </span>
        </label>
      </section>

      {/* Notifications */}
      <section className="card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Notifications</h2>
        <p className="text-sm text-gray-500">
          📧 Email alerts via SNS are configured server-side for your registered email.
        </p>
        <p className="text-sm text-gray-400">
          📱 SMS and WhatsApp alerts — coming soon.
        </p>
      </section>

      {/* Data */}
      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Data & Privacy</h2>
        <p className="text-xs text-gray-500">
          Well coordinates are rounded to ~100 m before storage. Owner identities are never shown publicly.
        </p>
        <button onClick={clearData} className="btn-secondary text-sm text-red-600 border-red-200">
          Clear Local Data
        </button>
      </section>

      <p className="text-xs text-center text-gray-400">
        Borewell Ledger — WeMakeDevs × AWS Environmental Hackathon 2024
      </p>
    </div>
  )
}
