import { useEffect, useState } from 'react'
import type { Book } from './types'
import { LibraryDashboard } from './components/LibraryDashboard'
import { PdfReader } from './components/PdfReader'
import { SettingsModal } from './components/SettingsModal'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function App() {
  const [activeBook, setActiveBook] = useState<Book | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallPwa = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  if (activeBook) {
    return <PdfReader book={activeBook} onBack={() => { setActiveBook(null); setRefreshTrigger(n => n + 1) }} />
  }

  return (
    <>
      <LibraryDashboard onOpenBook={setActiveBook} onOpenSettings={() => setSettingsOpen(true)} refreshTrigger={refreshTrigger} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onLibraryChanged={() => setRefreshTrigger(n => n + 1)} canInstallPwa={installPrompt !== null} onInstallPwa={handleInstallPwa} />
    </>
  )
}

export default App
