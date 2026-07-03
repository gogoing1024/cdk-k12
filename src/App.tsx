import { useState, useEffect } from 'react'
import StepCDK from './components/StepCDK'
import StepSession from './components/StepSession'
import StepActivate from './components/StepActivate'
import StepIndicator from './components/StepIndicator'
import AdminLogin from './admin/AdminLogin'
import AdminDashboard from './admin/AdminDashboard'
import { getAdminSession } from './admin/db'

export type SessionData = {
  accessToken: string
  user: {
    id: string
    name: string
    email: string
    image: string
  }
}

function AdminRoute() {
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const session = await getAdminSession()
        if (!mounted) return
        setAdminLoggedIn(session?.isLoggedIn === true)
      } catch {
        if (mounted) setAdminLoggedIn(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  if (adminLoggedIn === null) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (!adminLoggedIn) {
    return <AdminLogin onLogin={() => setAdminLoggedIn(true)} />
  }
  return (
    <AdminDashboard
      lang="vi"
      onLogout={() => {
        try { (window.location as any).href = '/' } catch { /* noop */ }
      }}
    />
  )
}

function MainApp() {
  const [step, setStep] = useState(1)
  const [cdkKey, setCdkKey] = useState('')
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [lang, setLang] = useState<'vi' | 'en'>('vi')

  const labels = {
    vi: {
      stepLabels: ['CDK Key', 'AuthSession', 'Kích hoạt'],
    },
    en: {
      stepLabels: ['CDK Key', 'AuthSession', 'Activate'],
    },
  }
  const t = labels[lang]

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      {/* Header */}
      <header className="bg-[#1a1d27] border-b border-[#2a2d3a]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 leading-tight">CDK K12</h1>
              <p className="text-[10px] text-slate-500 leading-tight">ChatGPT Plus Activation</p>
            </div>
          </div>

          <button
            onClick={() => setLang(l => l === 'vi' ? 'en' : 'vi')}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-[#22253a] border border-[#2a2d3a] text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all font-mono font-semibold"
          >
            {lang === 'vi' ? 'EN' : 'VI'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <StepIndicator currentStep={step} labels={t.stepLabels} />
          </div>

          {step === 1 && (
            <StepCDK
              lang={lang}
              onNext={(key) => {
                setCdkKey(key)
                setStep(2)
              }}
            />
          )}
          {step === 2 && (
            <StepSession
              lang={lang}
              onNext={(data) => {
                setSessionData(data)
                setStep(3)
              }}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepActivate
              lang={lang}
              cdkKey={cdkKey}
              sessionData={sessionData}
              onBack={() => setStep(2)}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function getInitialRoute(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname || '/'
}

function AppContent() {
  const [route, setRoute] = useState<string>(getInitialRoute)

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname || '/')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (route === '/admin') {
    return <AdminRoute />
  }
  return <MainApp />
}

export default AppContent
