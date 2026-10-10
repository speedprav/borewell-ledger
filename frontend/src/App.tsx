// App.tsx - Main application with routing and shell
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Shell } from './Shell'
import { WelcomePage } from './pages/WelcomePage'
import { DashboardPage } from './pages/DashboardPage'
import { MapPage } from './pages/MapPage'
import { AddReadingPage } from './pages/AddReadingPage'
import { MyWellsPage } from './pages/MyWellsPage'
import { WellDetailPage } from './pages/WellDetailPage'
import { AlertsPage } from './pages/AlertsPage'
import { AssistantPage } from './pages/AssistantPage'
import { PlanPage } from './pages/PlanPage'
import { CommunityPage } from './pages/CommunityPage'
import { SettingsPage } from './pages/SettingsPage'
import { AboutPage } from './pages/AboutPage'
import { ToastContainer } from './components/Toast'
import { getSettings, applyTheme } from './store'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const settings = getSettings()
    applyTheme(settings.theme)
    setReady(true)
  }, [])

  if (!ready) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route element={<Shell />}>
          <Route path="/home" element={<DashboardPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/add" element={<AddReadingPage />} />
          <Route path="/wells" element={<MyWellsPage />} />
          <Route path="/wells/:id" element={<WellDetailPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  )
}
