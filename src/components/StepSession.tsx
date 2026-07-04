import { useState, useRef } from 'react'
import { Clipboard, ChevronDown, ChevronUp, ArrowLeft, ArrowRight, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface StepSessionProps {
  lang: 'vi' | 'en'
  onNext: (data: any) => void
  onBack: () => void
}

function parseJwt(token: string) {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export default function StepSession({ lang, onNext, onBack }: StepSessionProps) {
  const [value, setValue] = useState('')
  const [showGuide, setShowGuide] = useState(true)
  const [error, setError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const labels = {
    vi: {
      title: 'Xác thực tài khoản',
      subtitle: 'Bước 2 trong 3',
      placeholder: 'Dán dữ liệu AuthSession từ ChatGPT vào đây...',
      next: 'Tiếp tục',
      back: 'Quay lại',
      guideTitle: 'Hướng dẫn lấy AuthSession',
      step1: 'Đăng nhập ChatGPT',
      step1Desc: 'Mở một tab mới, truy cập và đăng nhập tài khoản ChatGPT của bạn.',
      step2: 'Lấy dữ liệu AuthSession',
      step2Desc: 'Truy cập đường dẫn bên dưới, sao chép (Copy) toàn bộ nội dung hiển thị.',
      step3: 'Hoàn thành kích hoạt',
      step3Desc: 'Quay lại đây, dán dữ liệu vừa sao chép vào ô bên dưới.',
      note: 'Lưu ý',
      noteDesc: 'Nếu trạng thái tài khoản chưa đổi sau khi kích hoạt thành công, hãy tải lại trang ChatGPT vài lần.',
      copyLink: 'Sao chép',
      copied: 'Đã sao chép!',
      errorInvalid: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
      errorToken: 'Không tìm thấy accessToken trong dữ liệu.',
      userInfo: 'Thông tin tài khoản',
      email: 'Email',
      name: 'Tên',
      plan: 'Loại tài khoản',
      expires: 'Hết hạn',
    },
    en: {
      title: 'Account Verification',
      subtitle: 'Step 2 of 3',
      placeholder: 'Paste AuthSession data from ChatGPT here...',
      next: 'Continue',
      back: 'Back',
      guideTitle: 'How to get AuthSession',
      step1: 'Login to ChatGPT',
      step1Desc: 'Open a new tab, access and log in to your ChatGPT account.',
      step2: 'Get AuthSession data',
      step2Desc: 'Access the link below, copy the entire content displayed.',
      step3: 'Complete activation',
      step3Desc: 'Return here, paste the copied data into the box below.',
      note: 'Note',
      noteDesc: 'If account status does not change after successful activation, reload the ChatGPT page a few times.',
      copyLink: 'Copy',
      copied: 'Copied!',
      errorInvalid: 'Invalid data. Please check and try again.',
      errorToken: 'accessToken not found in data.',
      userInfo: 'Account Information',
      email: 'Email',
      name: 'Name',
      plan: 'Plan type',
      expires: 'Expires',
    },
  }
  const t = labels[lang]

  function attemptParse(raw: string) {
    setValue(raw)
    setError('')
    setParsing(true)
    setParsed(null)

    setTimeout(() => {
      try {
        const data = JSON.parse(raw.trim())
        if (!data.accessToken) {
          setError(t.errorToken)
          setParsing(false)
          return
        }
        setParsed(data)
        setParsing(false)
      } catch {
        setError(t.errorInvalid)
        setParsing(false)
      }
    }, 200)
  }

  function handleNext() {
    if (!parsed?.accessToken) return
    const jwt = parseJwt(parsed.accessToken)
    const prof = jwt?.['https://api.openai.com/profile'] || {}

    onNext({
      accessToken: parsed.accessToken,
      rawSession: parsed,
      user: {
        id: parsed.user?.id || '',
        name: prof.name || parsed.user?.name || '',
        email: prof.email || parsed.user?.email || '',
        image: prof.picture || parsed.user?.image || '',
      },
    })
  }

  function handlePaste(e: React.ClipboardEvent) {
    // Auto-parse on paste
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    attemptParse(text)
  }

  function formatExpiry(expires: number) {
    if (!expires) return '—'
    const d = new Date(expires * 1000)
    return d.toLocaleString('vi-VN')
  }

  function getPlanLabel(planType: string) {
    if (!planType) return '—'
    const map: Record<string, string> = {
      plus: 'ChatGPT Plus',
      pro: 'ChatGPT Pro',
      enterprise: 'Enterprise',
      team: 'Team',
      free: 'Free',
    }
    return map[planType.toLowerCase()] || planType
  }

  const jwt = parsed?.accessToken ? parseJwt(parsed.accessToken) : null
  const auth = jwt?.['https://api.openai.com/auth'] || {}
  const prof = jwt?.['https://api.openai.com/profile'] || {}

  return (
    <div className="animate-fade-in-up">
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6 shadow-xl">
        {/* Title */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <User size={20} className="text-indigo-400" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">{t.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t.subtitle}</p>
            </div>
          </div>
          <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
            <ArrowLeft size={14} strokeWidth={1.5} /> {t.back}
          </button>
        </div>

        {/* Guide accordion */}
        <button
          onClick={() => setShowGuide(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#22253a] border border-[#2a2d3a] rounded-xl mb-4 hover:bg-[#252840] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clipboard size={14} className="text-indigo-400" strokeWidth={1.5} />
            <span className="text-xs font-semibold text-slate-300">{t.guideTitle}</span>
          </div>
          {showGuide ? (
            <ChevronUp size={14} className="text-slate-500" strokeWidth={1.5} />
          ) : (
            <ChevronDown size={14} className="text-slate-500" strokeWidth={1.5} />
          )}
        </button>

        {showGuide && (
          <div className="bg-[#0f1117] border border-[#2a2d3a] rounded-xl p-4 mb-4 space-y-4 animate-fade-in-up">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-indigo-400">1</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">{t.step1}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{t.step1Desc}</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-indigo-400">2</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">{t.step2}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{t.step2Desc}</p>
                <div className="mt-2 flex items-center gap-2">
                  <a
                    href="https://chatgpt.com/api/auth/session"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                  >
                    chatgpt.com/api/auth/session ↗
                  </a>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-indigo-400">3</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">{t.step3}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{t.step3Desc}</p>
              </div>
            </div>

            {/* Note */}
            <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5">
                <span className="text-[9px] font-bold text-amber-400">!</span>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-amber-400">{t.note}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{t.noteDesc}</p>
              </div>
            </div>
          </div>
        )}

        {/* JSON Input */}
        <div className="space-y-2 mb-4">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => attemptParse(e.target.value)}
            onPaste={handlePaste}
            placeholder={t.placeholder}
            className={`w-full h-36 bg-[#22253a] border rounded-xl px-4 py-3 text-xs font-mono text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-2 transition-all ${
              error
                ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/20'
                : 'border-[#2a2d3a] focus:border-indigo-500/60 focus:ring-indigo-500/20'
            }`}
          />
          {parsing && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 size={12} className="animate-spin" />
              Đang phân tích...
            </div>
          )}
          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5 px-1">
              <AlertCircle size={12} strokeWidth={1.5} />
              {error}
            </p>
          )}
        </div>

        <button
          onClick={handleNext}
          disabled={!parsed?.accessToken}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold text-sm py-3 rounded-xl transition-all active:scale-[0.97] shadow-lg shadow-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t.next}
          <ArrowRight size={15} strokeWidth={2} />
        </button>

        {/* Parsed preview */}
        {parsed?.accessToken && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={14} className="text-emerald-400" strokeWidth={1.5} />
              <p className="text-xs font-bold text-emerald-400">{t.userInfo}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#1a1d27] rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{t.email}</p>
                <p className="text-xs text-slate-200 mt-0.5 truncate">{prof.email || parsed.user?.email || '—'}</p>
              </div>
              <div className="bg-[#1a1d27] rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{t.name}</p>
                <p className="text-xs text-slate-200 mt-0.5 truncate">{prof.name || parsed.user?.name || '—'}</p>
              </div>
              <div className="bg-[#1a1d27] rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{t.plan}</p>
                <p className="text-xs text-slate-200 mt-0.5">{getPlanLabel(auth.chatgpt_plan_type || '')}</p>
              </div>
              <div className="bg-[#1a1d27] rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{t.expires}</p>
                <p className="text-xs text-slate-200 mt-0.5">{formatExpiry(parsed.expires)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
