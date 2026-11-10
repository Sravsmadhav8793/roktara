import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, Bell, Bot, BriefcaseBusiness,
  Check, CheckCircle2, ChevronRight, CircleHelp, Copy, Download, FileImage,
  FileText, Fingerprint, Globe2, Home, Link2, LockKeyhole, Mail, MessageSquareText,
  Paperclip, PhoneCall, Plus, QrCode, Search, Send, Settings2, Share2, Shield,
  ShieldAlert, ShieldCheck, Smartphone, Sparkles, Upload, UserPlus, Users, Video, X, Zap
} from 'lucide-react'
import Login from './pages/Login'
import PasskeySettings from './pages/PasskeySettings'

type Tab = 'home' | 'bot' | 'check' | 'guard' | 'cases' | 'network' | 'settings'
type ChatMessage = { from: 'user' | 'bot'; text: string; risk?: 'risk' | 'safe' | 'review' }
type CheckType = 'Link' | 'UPI QR' | 'Message' | 'Screenshot'
type CaseStatus = 'High risk' | 'In review' | 'Resolved'
type CaseItem = { id: string; title: string; meta: string; status: CaseStatus; score: number; owner: string; time: string }
type ToastState = { message: string } | null

const initialCases: CaseItem[] = [
  { id: 'RKT-2841', title: 'Fake KYC verification link', meta: 'paytmn-kyc.help · 34 reports', status: 'High risk', score: 94, owner: 'Asha Rao', time: '09:42' },
  { id: 'RKT-2838', title: 'Refund request from unknown VPA', meta: 'refund-help@okaxis · 18 reports', status: 'In review', score: 71, owner: 'Unassigned', time: '09:18' },
  { id: 'RKT-2829', title: 'Delivery fee APK campaign', meta: 'Android package · 11 reports', status: 'High risk', score: 89, owner: 'Vihaan S.', time: '08:51' },
  { id: 'RKT-2814', title: 'Vendor invoice domain', meta: 'supplier-update.co · cleared', status: 'Resolved', score: 12, owner: 'Asha Rao', time: 'Yesterday' },
]

const sampleText: Record<CheckType, string> = {
  Link: 'https://paytmn-kyc.help/verify',
  'UPI QR': 'upi://pay?pa=refund-help@okaxis&pn=Customer%20Support',
  Message: 'URGENT: Your bank account will be blocked today. Complete KYC at paytmn-kyc.help or call +91 98765 43210.',
  Screenshot: 'customer-support-whatsapp.png',
}

function downloadFile(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function Workspace() {
  const [tab, setTab] = useState<Tab>('home')
  const [checkType, setCheckType] = useState<CheckType>('Link')
  const [input, setInput] = useState(sampleText.Link)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<'risk' | 'safe' | null>(null)
  const [cases, setCases] = useState(initialCases)
  const [caseFilter, setCaseFilter] = useState<'All' | CaseStatus>('All')
  const [search, setSearch] = useState('')
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null)
  const [modal, setModal] = useState<'notifications' | 'team' | 'api' | 'channels' | 'permissions' | 'help' | null>(null)
  const [accessMode, setAccessMode] = useState<'forward' | 'notifications'>('forward')
  const [shareEvidence, setShareEvidence] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const [readNotifications, setReadNotifications] = useState(false)
  const [autoHold, setAutoHold] = useState(true)
  const [regionalAlerts, setRegionalAlerts] = useState(true)
  const [team, setTeam] = useState(['Asha Rao · Risk admin', 'Vihaan S. · Analyst'])
  const [memberEmail, setMemberEmail] = useState('')
  const [formError, setFormError] = useState('')
  const [deferredInstall, setDeferredInstall] = useState<any>(null)
  const [channel, setChannel] = useState<'WhatsApp' | 'Telegram'>('WhatsApp')
  const [botInput, setBotInput] = useState('')
  const [botBusy, setBotBusy] = useState(false)
  const [chat, setChat] = useState<ChatMessage[]>([
    { from: 'user', text: 'Forwarded: URGENT! Your account will be blocked. Complete KYC now at paytmn-kyc.help' },
    { from: 'bot', text: 'High risk signals found. Do not open the link or share OTP, PIN or account details. Verify through your bank’s official app.', risk: 'risk' },
  ])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setDeferredInstall(event)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null)
        setSelectedCase(null)
      }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])

  const visibleCases = useMemo(() => cases.filter((item) => {
    const filterMatch = caseFilter === 'All' || item.status === caseFilter
    const searchMatch = `${item.title} ${item.meta} ${item.id}`.toLowerCase().includes(search.toLowerCase())
    return filterMatch && searchMatch
  }), [cases, caseFilter, search])

  function navigate(next: Tab) {
    setTab(next)
    setResult(null)
    setSelectedCase(null)
  }

  function startCheck(type: CheckType) {
    setCheckType(type)
    setInput(sampleText[type])
    setResult(null)
    setTab('check')
  }

  function runCheck() {
    if (!input.trim()) {
      setToast({ message: 'Add something to check first.' })
      return
    }
    setChecking(true)
    setResult(null)
    window.setTimeout(() => {
      const normalized = input.toLowerCase()
      const safe = normalized.includes('npci.org.in') || normalized.includes('google.com') || normalized.includes('verified-vendor')
      setResult(safe ? 'safe' : 'risk')
      setChecking(false)
    }, 1100)
  }

  function createCase() {
    const id = `RKT-${2850 + cases.length}`
    const next: CaseItem = {
      id,
      title: checkType === 'Link' ? 'Suspicious payment link' : checkType === 'UPI QR' ? 'Suspicious UPI collect request' : checkType === 'Message' ? 'Suspected impersonation message' : 'Suspicious support screenshot',
      meta: `${input.slice(0, 34)}${input.length > 34 ? '…' : ''} · 1 report`,
      status: result === 'safe' ? 'In review' : 'High risk',
      score: result === 'safe' ? 12 : 92,
      owner: 'Asha Rao',
      time: 'Now',
    }
    setCases([next, ...cases])
    setResult(null)
    setTab('cases')
    setToast({ message: `${id} created in the demo workspace.` })
  }

  async function shareAdvisory() {
    const text = `Roktara demo advisory: ${result === 'risk' ? 'High risk' : 'Low risk'} signals detected in ${input}. Do not use this prototype for live payment decisions.`
    try {
      if (navigator.share) await navigator.share({ title: 'Roktara demo advisory', text })
      else {
        await navigator.clipboard.writeText(text)
        setToast({ message: 'Demo advisory copied to clipboard.' })
      }
    } catch { /* Share sheet dismissed. */ }
  }

  function exportCases() {
    const rows = ['ID,Title,Status,Score,Owner', ...visibleCases.map((c) => `${c.id},"${c.title}",${c.status},${c.score},"${c.owner}"`)]
    downloadFile('roktara-demo-cases.csv', rows.join('\n'), 'text/csv')
    setToast({ message: 'Case register exported.' })
  }

  function addMember() {
    if (!/^\S+@\S+\.\S+$/.test(memberEmail)) {
      setFormError('Enter a valid work email address.')
      return
    }
    setTeam([...team, `${memberEmail} · Invited`])
    setMemberEmail('')
    setFormError('')
    setModal(null)
    setToast({ message: 'Demo team invitation added.' })
  }

  async function installApp() {
    if (deferredInstall) {
      deferredInstall.prompt()
      await deferredInstall.userChoice
      setDeferredInstall(null)
    } else setToast({ message: 'Use your browser menu and choose Add to Home Screen.' })
  }

  function sendToBot(preset?: string) {
    const content = (preset || botInput).trim()
    if (!content) {
      setToast({ message: 'Forward a message or choose a sample first.' })
      return
    }
    setChat((current) => [...current, { from: 'user', text: content }])
    setBotInput('')
    setBotBusy(true)
    window.setTimeout(() => {
      const normalized = content.toLowerCase()
      const safe = normalized.includes('npci.org.in') || normalized.includes('verified-vendor')
      const suspicious = /urgent|kyc|apk|upi|http|otp|blocked|refund|link|delivery|customer.support/.test(normalized)
      const assessment = safe ? 'safe' : suspicious ? 'risk' : 'review'
      setChat((current) => [...current, {
        from: 'bot',
        text: assessment === 'safe' ? 'No major sample signals found. Continue standard verification before paying or sharing information.' : assessment === 'risk' ? 'High risk signals found. Pause. Do not open links, install files, share OTP/PIN or pay until the sender is verified through a trusted channel.' : 'Uncertain result. There is not enough evidence in this demo. Keep the payment or information request on hold and ask an analyst to review it.',
        risk: assessment,
      }])
      setBotBusy(false)
    }, 850)
  }

  function createBotCase() {
    const lastUser = [...chat].reverse().find((message) => message.from === 'user')
    const lastAssessment = [...chat].reverse().find((message) => message.from === 'bot')?.risk
    const id = `RKT-${2900 + cases.length}`
    const next: CaseItem = { id, title: `${channel} forwarded-content check`, meta: `${(lastUser?.text || 'Forwarded content').slice(0, 42)}… · user consent`, status: lastAssessment === 'risk' ? 'High risk' : 'In review', score: lastAssessment === 'risk' ? 92 : 48, owner: 'Asha Rao', time: 'Now' }
    setCases([next, ...cases])
    setTab('cases')
    setToast({ message: `${id} created from the consented ${channel} demo.` })
  }

  function createGuardCase(scenario: string) {
    const id = `RKT-${3000 + cases.length}`
    const next: CaseItem = { id, title: scenario, meta: 'Call Guard · user-initiated escalation', status: 'High risk', score: 96, owner: 'Asha Rao', time: 'Now' }
    setCases([next, ...cases])
    setTab('cases')
    setToast({ message: `${id} created. Keep the payment on hold.` })
  }

  const navItems: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'bot', label: 'Bot', icon: Bot },
    { id: 'guard', label: 'Call Guard', icon: PhoneCall },
    { id: 'cases', label: 'Cases', icon: BriefcaseBusiness },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ]

  return (
    <div className="site-shell">
      <aside className="story-panel" aria-label="About this prototype">
        <div className="story-brand"><BrandMark /><span>ROKTARA</span></div>
        <div className="story-copy">
          <p className="overline">BUSINESS FRAUD INTELLIGENCE · DEMO</p>
          <h1>Forward it.<br /><em>Check it first.</em></h1>
          <p>Roktara lives inside messaging workflows. Users explicitly forward suspicious messages, links, UPI requests, screenshots and files for multi-signal risk checks.</p>
          <div className="story-audience"><span>Built for</span><strong>Fintechs · Banks · Payment teams</strong></div>
          <button className="story-cta" onClick={() => startCheck('Link')}>Try the risk check <ArrowRight size={18} /></button>
        </div>
        <div className="story-note"><LockKeyhole size={16} /><span>Interactive prototype. Sample data only.<br />Not a live fraud-detection service.</span></div>
      </aside>

      <main className="prototype-stage">
        <div className="stage-caption"><span>Mobile product prototype</span><span>Bengaluru · Business edition</span></div>
        <section className="phone" aria-label="Roktara mobile application">
          <div className="phone-speaker" aria-hidden="true" />
          <div className="app-viewport">
            <header className="app-header">
              <button className="brand-button" onClick={() => navigate('home')} aria-label="Go to home"><BrandMark /><span>roktara</span><small>BUSINESS</small></button>
              <button className="icon-button notification-button" onClick={() => setModal('notifications')} aria-label="Open notifications">
                <Bell size={20} />{!readNotifications && <span className="notification-dot" />}
              </button>
            </header>

            <div className="app-scroll" key={tab}>
              {tab === 'home' && <HomeScreen cases={cases} onCheck={startCheck} onCase={setSelectedCase} onNetwork={() => navigate('network')} onBot={() => navigate('bot')} onGuard={() => navigate('guard')} />}
              {tab === 'bot' && <BotScreen channel={channel} setChannel={setChannel} chat={chat} input={botInput} setInput={setBotInput} busy={botBusy} send={sendToBot} createCase={createBotCase} accessMode={accessMode} onPermissions={() => setModal('permissions')} />}
              {tab === 'guard' && <CallGuardScreen onEscalate={createGuardCase} onToast={setToast} />}
              {tab === 'check' && (
                <CheckScreen type={checkType} setType={startCheck} input={input} setInput={setInput} checking={checking} result={result}
                  runCheck={runCheck} createCase={createCase} shareAdvisory={shareAdvisory} fileRef={fileRef} />
              )}
              {tab === 'cases' && <CasesScreen cases={visibleCases} filter={caseFilter} setFilter={setCaseFilter} search={search} setSearch={setSearch} onCase={setSelectedCase} onExport={exportCases} />}
              {tab === 'network' && <NetworkScreen onDownload={() => { downloadFile('roktara-demo-intelligence-brief.txt', 'ROKTARA DEMO INTELLIGENCE BRIEF\n\nKYC impersonation cluster\n34 linked reports\nObserved signals: lookalike domain, urgency language, payment redirection.\n\nPrototype data only. Not a live threat advisory.') ; setToast({ message: 'Intelligence brief downloaded.' }) }} />}
              {tab === 'settings' && <SettingsScreen autoHold={autoHold} setAutoHold={setAutoHold} regionalAlerts={regionalAlerts} setRegionalAlerts={setRegionalAlerts} team={team} onAdd={() => setModal('team')} onApi={() => setModal('api')} onChannels={() => setModal('channels')} onPermissions={() => setModal('permissions')} onInstall={installApp} onExport={() => { downloadFile('roktara-demo-workspace.json', JSON.stringify({ workspace: 'NammaPay demo', cases, team, autoHold, regionalAlerts }, null, 2), 'application/json'); setToast({ message: 'Workspace demo data exported.' }) }} onHelp={() => setModal('help')} />}
            </div>

            <nav className="bottom-nav" aria-label="Main navigation">
              {navItems.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => navigate(item.id)} aria-current={tab === item.id ? 'page' : undefined}><item.icon size={20} /><span>{item.label}</span></button>)}
            </nav>
          </div>
        </section>
        <p className="stage-footnote">Sample intelligence · No payment credentials required</p>
      </main>

      {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast.message}</div>}

      {selectedCase && <Modal onClose={() => setSelectedCase(null)} title={selectedCase.id} eyebrow="CASE DETAIL">
        <div className="case-detail-heading"><RiskBadge status={selectedCase.status} /><span>Score {selectedCase.score}/100</span></div>
        <h3>{selectedCase.title}</h3><p className="muted">{selectedCase.meta}</p>
        <dl className="detail-list"><div><dt>Owner</dt><dd>{selectedCase.owner}</dd></div><div><dt>Last activity</dt><dd>{selectedCase.time}</dd></div><div><dt>Recommended action</dt><dd>{selectedCase.status === 'Resolved' ? 'Retain for audit history' : 'Hold payment and verify through a trusted channel'}</dd></div></dl>
        <div className="timeline"><strong>Activity</strong><p><span />Check completed · Automated demo signals attached</p><p><span />Case created · NammaPay risk workspace</p></div>
        {selectedCase.status !== 'Resolved' ? <button className="primary-button full" onClick={() => { setCases(cases.map((c) => c.id === selectedCase.id ? { ...c, status: 'Resolved', owner: 'Asha Rao' } : c)); setSelectedCase(null); setToast({ message: `${selectedCase.id} marked resolved.` }) }}><Check size={18} />Resolve case</button> : <button className="secondary-button full" onClick={() => setSelectedCase(null)}>Close case</button>}
      </Modal>}

      {modal === 'notifications' && <Modal onClose={() => setModal(null)} title="Notifications" eyebrow="DEMO WORKSPACE">
        {!readNotifications ? <div className="notification-list"><div><ShieldAlert size={20} /><p><strong>KYC campaign updated</strong><span>14 new lookalike domains added to the sample cluster.</span><small>8 minutes ago</small></p></div><div><Users size={20} /><p><strong>Case assigned to you</strong><span>RKT-2838 needs analyst review.</span><small>31 minutes ago</small></p></div></div> : <EmptyState icon={CheckCircle2} title="You're all caught up" text="Demo notifications have been marked as read." />}
        <button className="secondary-button full" disabled={readNotifications} onClick={() => { setReadNotifications(true); setModal(null); setToast({ message: 'Notifications marked as read.' }) }}>Mark all as read</button>
      </Modal>}

      {modal === 'team' && <Modal onClose={() => setModal(null)} title="Invite analyst" eyebrow="TEAM ACCESS">
        <p className="muted">Add a work email to simulate a role-based team invitation.</p>
        <label className="field-label" htmlFor="member-email">Work email</label>
        <div className="input-with-icon"><Mail size={18} /><input id="member-email" type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="analyst@company.com" /></div>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="primary-button full" onClick={addMember}><UserPlus size={18} />Add invitation</button>
      </Modal>}

      {modal === 'api' && <Modal onClose={() => setModal(null)} title="Risk Check API" eyebrow="INTEGRATION PREVIEW">
        <p className="muted">Illustrative request shape for a future payment or case-management integration.</p>
        <pre className="code-block">{`POST /v1/checks\n{\n  "type": "upi_qr",\n  "value": "upi://pay?pa=...",\n  "channel": "payment_gateway",\n  "customer_reference": "tokenized_id"\n}`}</pre>
        <p className="privacy-note"><LockKeyhole size={16} />Production design should minimize personal data and retain only approved evidence.</p>
        <button className="secondary-button full" onClick={async () => { await navigator.clipboard.writeText('POST /v1/checks — Roktara demo API'); setToast({ message: 'API example copied.' }) }}><Copy size={17} />Copy example</button>
      </Modal>}

      {modal === 'permissions' && <Modal onClose={() => setModal(null)} title="Message access" eyebrow="USER CONTROL · GRANULAR CONSENT">
        <p className="muted">Choose what Roktara may process. Protection works without granting inbox or notification access.</p>
        <div className="permission-options" role="radiogroup" aria-label="Message access mode">
          <button role="radio" aria-checked={accessMode === 'forward'} className={accessMode === 'forward' ? 'selected' : ''} onClick={() => setAccessMode('forward')}><span className="radio-dot" /><p><strong>Forward & share only</strong><span>Process only text, links, images or files you intentionally send to Roktara.</span><small>Recommended · Android and iPhone</small></p></button>
          <button role="radio" aria-checked={accessMode === 'notifications'} className={accessMode === 'notifications' ? 'selected' : ''} onClick={() => setAccessMode('notifications')}><span className="radio-dot" /><p><strong>Android notification previews</strong><span>Process newly arriving, visible previews from selected messaging apps on this device.</span><small>Optional · No chat-history access</small></p></button>
        </div>
        {accessMode === 'notifications' && <div className="permission-details"><strong>What this does not allow</strong><p>No unrestricted WhatsApp inbox, old messages, contacts, OTPs, passwords or payment PINs. Notification access may still require Google Play approval.</p><strong>On-device first</strong><p>Filter supported apps and discard unrelated or sensitive notifications immediately. Revoke anytime in Android Settings.</p></div>}
        <button className={`evidence-consent ${shareEvidence ? 'checked' : ''}`} onClick={() => setShareEvidence(!shareEvidence)} aria-pressed={shareEvidence}><span>{shareEvidence && <Check size={14} />}</span><p><strong>Separate business-sharing consent</strong><small>Allow suspicious evidence to be shared with my organization. Never share the full inbox.</small></p></button>
        <button className="primary-button full" onClick={() => { if (accessMode === 'forward') setShareEvidence(false); setModal(null); setToast({ message: accessMode === 'forward' ? 'Forward-only protection selected.' : 'Android notification-preview mode selected for the demo.' }) }}>Save permission choice</button>
        {accessMode === 'notifications' && <button className="text-button revoke-button" onClick={() => { setAccessMode('forward'); setShareEvidence(false); setModal(null); setToast({ message: 'Notification access revoked. Forward-only mode restored.' }) }}>Revoke notification access</button>}
      </Modal>}

      {modal === 'channels' && <Modal onClose={() => setModal(null)} title="Messaging channels" eyebrow="CONSENT-BASED INTEGRATIONS">
        <div className="channel-plan"><div><Smartphone size={21} /><p><strong>WhatsApp Business Platform</strong><span>Production path: a dedicated business bot receives content users intentionally send or forward.</span></p><small>PLANNED</small></div><div><Send size={21} /><p><strong>Telegram Bot API</strong><span>Production path: users interact directly with a Roktara bot; no ordinary-account inbox access.</span></p><small>PLANNED</small></div></div>
        <p className="privacy-note"><LockKeyhole size={16} />Roktara does not request access to unrelated chats, contact lists, OTPs, UPI PINs or passwords.</p>
        <button className="primary-button full" onClick={() => { setModal(null); setTab('bot') }}>Open bot demo</button>
      </Modal>}

      {modal === 'help' && <Modal onClose={() => setModal(null)} title="About this demo" eyebrow="PROTOTYPE GUIDE">
        <div className="help-copy"><p><strong>What works:</strong> messaging-bot simulation, navigation, sample checks, case creation and resolution, search, filters, exports, alert settings and team invitations.</p><p><strong>What is simulated:</strong> WhatsApp/Telegram delivery, fraud scores, threat intelligence, OCR, QR decoding, malware reputation and API connectivity. No entered content is sent to a server.</p><p><strong>Production requirement:</strong> independently validated models, security testing, audited data handling and clear human-review policies.</p></div>
        <button className="primary-button full" onClick={() => setModal(null)}>Got it</button>
      </Modal>}
    </div>
  )
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><Shield size={19} strokeWidth={2.4} /><span /></span>
}

function HomeScreen({ cases, onCheck, onCase, onNetwork, onBot, onGuard }: { cases: CaseItem[]; onCheck: (type: CheckType) => void; onCase: (item: CaseItem) => void; onNetwork: () => void; onBot: () => void; onGuard: () => void }) {
  return <>
    <section className="welcome-block" data-animate style={{ '--stagger': 1 } as React.CSSProperties}><p className="eyebrow">NammaPay · Risk operations</p><h2>Good morning, Asha.</h2><p>Your demo workspace has <strong>2 items needing attention.</strong></p></section>
    <section className="metric-strip" data-animate style={{ '--stagger': 2 } as React.CSSProperties}><div><strong>1,284</strong><span>Checks today</span></div><div><strong>37</strong><span>High risk</span></div><div><strong>99.2%</strong><span>API uptime</span></div></section>
    <button className="campaign-banner" onClick={onNetwork} data-animate style={{ '--stagger': 3 } as React.CSSProperties}><span className="campaign-icon"><Zap size={19} /></span><span><small>ACTIVE CAMPAIGN · SAMPLE</small><strong>KYC impersonation cluster</strong><span>34 linked reports · 6 new today</span></span><ChevronRight size={20} /></button>
    <button className="callguard-banner" onClick={onGuard}><PhoneCall size={23} /><span><small>FAMILY + OFFICIAL IMPERSONATION</small><strong>Pause suspicious calls</strong><span>Deepfake family · Customs · CBI · ED</span></span><ArrowRight size={19} /></button>
    <button className="messaging-banner" onClick={onBot}><span className="messaging-icon"><Bot size={23} /></span><span><small>MESSAGING COPILOT</small><strong>Forward it to Roktara</strong><span>Try the WhatsApp and Telegram bot demo</span></span><ArrowRight size={19} /></button>
    <section className="section-block"><div className="section-heading"><h3>Quick check</h3><span>4 input types</span></div><div className="quick-grid">
      <button onClick={() => onCheck('Link')}><Link2 size={22} /><span>Link</span><small>URL or domain</small></button>
      <button onClick={() => onCheck('UPI QR')}><QrCode size={22} /><span>UPI QR</span><small>Payment request</small></button>
      <button onClick={() => onCheck('Message')}><MessageSquareText size={22} /><span>Message</span><small>SMS or WhatsApp</small></button>
      <button onClick={() => onCheck('Screenshot')}><FileImage size={22} /><span>Screenshot</span><small>Visual evidence</small></button>
    </div></section>
    <section className="section-block recent-section"><div className="section-heading"><h3>Recent cases</h3><span>Live demo register</span></div>{cases.slice(0, 3).map((item) => <CaseRow key={item.id} item={item} onClick={() => onCase(item)} />)}</section>
    <div className="system-note"><ShieldCheck size={16} /><span>Demo rules and sample intelligence are active.</span></div>
  </>
}

function CallGuardScreen({ onEscalate, onToast }: any) {
  const [scenario, setScenario] = useState<'family' | 'official'>('family')
  const [code, setCode] = useState('')
  const [codeSaved, setCodeSaved] = useState(false)
  const [completed, setCompleted] = useState<number[]>([])
  const familySteps = ['End the video call and keep the payment on hold', 'Call the relative back on their already saved number', 'Ask for your private family verification code', 'Confirm the emergency with a second relative']
  const officialSteps = ['Hang up—do not stay on video under pressure', 'Do not pay a fine, bail amount or “safe account” transfer', 'Verify notices through the agency’s official website or switchboard', 'Preserve the number, messages and payment details for reporting']
  const steps = scenario === 'family' ? familySteps : officialSteps
  function selectScenario(next: 'family' | 'official') { setScenario(next); setCompleted([]) }
  return <>
    <section className="guard-hero"><span><PhoneCall size={25} /></span><p className="eyebrow">CALL GUARD · PAYMENT INTERRUPTION</p><h2>Pause. Verify.<br />Then pay.</h2><p>A familiar face, voice, uniform or official document is not enough proof during a money request.</p></section>
    <div className="scenario-tabs" role="tablist" aria-label="Call scam scenario"><button role="tab" aria-selected={scenario === 'family'} className={scenario === 'family' ? 'active' : ''} onClick={() => selectScenario('family')}><Video size={18} />Family video</button><button role="tab" aria-selected={scenario === 'official'} className={scenario === 'official' ? 'active' : ''} onClick={() => selectScenario('official')}><ShieldAlert size={18} />Customs / CBI / ED</button></div>
    <section className="guard-warning"><AlertTriangle size={21} /><div><strong>{scenario === 'family' ? 'Possible family-emergency impersonation' : 'Possible “digital arrest” impersonation'}</strong><p>{scenario === 'family' ? 'Deepfake video and cloned voices can look convincing. Verify out-of-band; do not depend on appearance or voice.' : 'No digital or online arrest. Threats, secrecy, video surveillance and urgent transfers are strong scam signals.'}</p></div></section>
    <section className="guard-signals"><h3>Signals to notice</h3><div>{(scenario === 'family' ? ['New number or changed payment account', 'Medical, accident, police or ransom emergency', 'Urgency, secrecy or emotional pressure', 'Refusal to answer personal verification questions'] : ['Claims of illegal parcel, money laundering or arrest', 'Demand for bail, penalty or fund regularization', 'Instructions to remain on video or tell nobody', 'Official-looking notices sent through messaging apps']).map((signal) => <span key={signal}>{signal}</span>)}</div></section>
    <section className="verification-checklist"><div className="section-heading"><h3>Safe verification</h3><span>{completed.length}/{steps.length} completed</span></div>{steps.map((step, index) => <button key={step} className={completed.includes(index) ? 'done' : ''} onClick={() => setCompleted(completed.includes(index) ? completed.filter((item) => item !== index) : [...completed, index])}><span>{completed.includes(index) && <Check size={15} />}</span><p>{step}</p></button>)}</section>
    {scenario === 'family' ? <section className="family-code"><div><strong>Family verification code</strong><span>Agree on a code offline. Never send it to the caller or store it in chat.</span></div><div className="code-entry"><input aria-label="Family verification code" value={code} onChange={(e) => { setCode(e.target.value); setCodeSaved(false) }} placeholder="Set a demo code" maxLength={24} /><button onClick={() => { if (code.trim().length < 4) { onToast({ message: 'Use at least 4 characters for the demo code.' }); return } setCodeSaved(true); onToast({ message: 'Demo code saved for this screen only.' }) }}>{codeSaved ? <Check size={17} /> : 'Save'}</button></div></section> : <a className="official-link" href="https://enforcementdirectorate.gov.in/" target="_blank" rel="noreferrer">Open official ED website to verify summons<ArrowRight size={17} /></a>}
    <button className="primary-button full" onClick={() => onEscalate(scenario === 'family' ? 'Family video-call payment impersonation' : 'Customs/CBI/ED digital-arrest impersonation')}><ShieldAlert size={18} />Create safety case</button>
    <div className="emergency-actions"><a href="tel:1930"><PhoneCall size={17} />Call 1930</a><a href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer">Report cybercrime<ArrowRight size={16} /></a></div>
    <p className="demo-disclaimer spaced">Call Guard provides decision support, not identity proof or guaranteed deepfake detection. If money was sent, contact the bank and cybercrime authorities immediately.</p>
  </>
}

function BotScreen({ channel, setChannel, chat, input, setInput, busy, send, createCase, accessMode, onPermissions }: any) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [chat, busy])
  return <div className="bot-screen">
    <button className="access-status" onClick={onPermissions}><LockKeyhole size={16} /><span><strong>{accessMode === 'forward' ? 'Forward-only access' : 'Android notification previews'}</strong><small>{accessMode === 'forward' ? 'You choose every item checked' : 'Optional device permission · demo enabled'}</small></span><Settings2 size={16} /></button>
    <div className="channel-switch" role="tablist" aria-label="Messaging channel">{['WhatsApp', 'Telegram'].map((name) => <button key={name} role="tab" aria-selected={channel === name} className={channel === name ? 'active' : ''} onClick={() => setChannel(name)}>{name === 'WhatsApp' ? <Smartphone size={16} /> : <Send size={16} />}{name}</button>)}</div>
    <section className="chat-shell">
      <header className="chat-header"><span className="bot-avatar"><Bot size={21} /></span><div><strong>Roktara Secure Bot</strong><span>{channel} · interactive demo</span></div><ShieldCheck size={19} /></header>
      <div className="consent-strip"><LockKeyhole size={14} /><span>{accessMode === 'forward' ? 'Only content you intentionally forward is checked. No access to unrelated chats.' : 'Demo: only new visible previews from selected messaging apps. No chat history or unrelated notifications.'}</span></div>
      <div className="chat-messages">
        <div className="encryption-note">DEMO CONVERSATION · SAMPLE CONTENT</div>
        {chat.map((message: ChatMessage, index: number) => <div key={`${index}-${message.text.slice(0, 8)}`} className={`chat-bubble ${message.from} ${message.risk || ''}`}>
          {message.from === 'bot' && <span className="bubble-label"><ShieldCheck size={13} />ROKTARA CHECK</span>}
          <p>{message.text}</p>
          {message.risk && <><div className="chat-risk-meta"><strong>{message.risk === 'risk' ? '92/100' : message.risk === 'safe' ? '12/100' : '48/100'}</strong><span>{message.risk === 'risk' ? 'High risk · demo' : message.risk === 'safe' ? 'Low signals · demo' : 'Needs review · demo'}</span></div><details className="coverage-details"><summary>Signals checked</summary><ul><li>URL reputation, redirects and lookalike domains</li><li>UPI payee identity and payment intent</li><li>Impersonation and urgency language</li><li>OCR text, QR content and attachment reputation</li><li>Sender and linked-campaign reports</li></ul><p>No check can guarantee detection of every threat.</p></details><button className="chat-case-button" onClick={createCase}><Plus size={14} />Escalate to business case</button></>}
        </div>)}
        {busy && <div className="chat-bubble bot typing"><span /><span /><span /><small>Checking sample signals</small></div>}
        <div ref={endRef} />
      </div>
      <div className="sample-attachments"><button onClick={() => send('Forwarded link: https://paytmn-kyc.help/verify')}><Link2 size={15} />Link</button><button onClick={() => send('UPI QR: pay refund-help@okaxis · collect request')}><QrCode size={15} />UPI QR</button><button onClick={() => send('Screenshot: customer-support-warning.png')}><FileImage size={15} />Screenshot</button><button onClick={() => send('Attachment: delivery-update.apk')}><Paperclip size={15} />APK</button></div>
      <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send() }}><input aria-label="Message for Roktara bot" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste or forward suspicious content" /><button type="submit" disabled={busy} aria-label="Send to Roktara bot"><Send size={18} /></button></form>
    </section>
    <p className="demo-disclaimer">Simulated responses. Production analysis must return confidence, evidence and an uncertain state—not guaranteed safety.</p>
  </div>
}

function CheckScreen({ type, setType, input, setInput, checking, result, runCheck, createCase, shareAdvisory, fileRef }: any) {
  const types: { name: CheckType; icon: typeof Link2 }[] = [{ name: 'Link', icon: Link2 }, { name: 'UPI QR', icon: QrCode }, { name: 'Message', icon: MessageSquareText }, { name: 'Screenshot', icon: FileImage }]
  return <>
    <section className="page-title"><p className="eyebrow">PRE-TRANSACTION CHECK</p><h2>What looks suspicious?</h2><p>Run a sample assessment before your team acts.</p></section>
    <div className="type-tabs" role="tablist" aria-label="Check type">{types.map((item) => <button role="tab" aria-selected={type === item.name} className={type === item.name ? 'active' : ''} key={item.name} onClick={() => setType(item.name)}><item.icon size={18} /><span>{item.name}</span></button>)}</div>
    <section className="check-form">
      {type === 'UPI QR' && <div className="qr-sample" aria-label="Illustrative QR code"><QrPattern /><span>Sample QR payload loaded</span></div>}
      {type === 'Screenshot' && <button className="upload-zone" onClick={() => fileRef.current?.click()}><Upload size={24} /><strong>Choose a screenshot</strong><span>PNG or JPG · processed locally in this demo</span></button>}
      <label className="field-label" htmlFor="check-input">{type === 'Link' ? 'URL or domain' : type === 'UPI QR' ? 'Decoded UPI payload' : type === 'Message' ? 'Message content' : 'Selected file name'}</label>
      {type === 'Message' ? <textarea id="check-input" rows={5} value={input} onChange={(e) => setInput(e.target.value)} /> : <input id="check-input" value={input} onChange={(e) => setInput(e.target.value)} readOnly={type === 'UPI QR' || type === 'Screenshot'} />}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) setInput(file.name) }} />
      <button className="primary-button full check-button" disabled={checking} onClick={runCheck}>{checking ? <><span className="spinner" />Checking sample signals…</> : <><Sparkles size={18} />Run demo check</>}</button>
      <p className="demo-disclaimer">Demonstration only. Results are generated locally and are not live fraud verdicts.</p>
    </section>
    {result && <section className={`result-panel ${result}`}>
      <div className="result-top"><span className="result-icon">{result === 'risk' ? <ShieldAlert size={26} /> : <ShieldCheck size={26} />}</span><div><small>DEMO ASSESSMENT</small><h3>{result === 'risk' ? 'High risk signals found' : 'No major sample signals'}</h3></div><strong>{result === 'risk' ? '92' : '12'}<small>/100</small></strong></div>
      <div className="risk-meter"><span style={{ width: result === 'risk' ? '92%' : '12%' }} /></div>
      <div className="signal-list"><strong>{result === 'risk' ? 'Why this was flagged' : 'What was checked'}</strong>
        {(result === 'risk' ? ['Lookalike domain or unverified payment identity', 'Urgency language commonly used in impersonation', 'Payment action requested outside a trusted flow'] : ['No sample lookalike pattern matched', 'No urgency phrase detected', 'Still verify through your normal trusted channel']).map((signal) => <p key={signal}><AlertTriangle size={16} />{signal}</p>)}
      </div>
      <div className="recommended-action"><LockKeyhole size={18} /><p><strong>Recommended action</strong><span>{result === 'risk' ? 'Pause the transaction. Verify through an independently sourced contact.' : 'Proceed only after your standard verification checks.'}</span></p></div>
      <div className="result-actions"><button className="primary-button" onClick={createCase}><Plus size={17} />Create case</button><button className="secondary-button" onClick={shareAdvisory}><Share2 size={17} />Share</button></div>
    </section>}
  </>
}

function QrPattern() {
  const cells = Array.from({ length: 81 }, (_, i) => ((i * 7 + i * i * 3 + 2) % 11) < 5)
  return <div className="qr-pattern" aria-hidden="true">{cells.map((on, i) => <span key={i} className={on ? 'on' : ''} />)}</div>
}

function CasesScreen({ cases, filter, setFilter, search, setSearch, onCase, onExport }: any) {
  return <>
    <section className="page-title with-action"><div><p className="eyebrow">RISK OPERATIONS</p><h2>Case register</h2></div><button className="icon-button bordered" onClick={onExport} aria-label="Export cases"><Download size={20} /></button></section>
    <div className="search-box"><Search size={18} /><input aria-label="Search cases" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, URL or campaign" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={16} /></button>}</div>
    <div className="filter-row">{['All', 'High risk', 'In review', 'Resolved'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
    <p className="result-count">{cases.length} {cases.length === 1 ? 'case' : 'cases'} in this view</p>
    <section className="case-list">{cases.length ? cases.map((item: CaseItem) => <CaseRow key={item.id} item={item} onClick={() => onCase(item)} />) : <EmptyState icon={Search} title="No matching cases" text="Try another search or clear the selected filter." />}</section>
  </>
}

function CaseRow({ item, onClick }: { item: CaseItem; onClick: () => void }) {
  return <button className="case-row" onClick={onClick}><span className={`case-score ${item.score > 80 ? 'danger' : item.score > 40 ? 'warning' : 'safe'}`}>{item.score}</span><span className="case-main"><span className="case-title">{item.title}</span><span className="case-meta">{item.id} · {item.meta}</span><RiskBadge status={item.status} /></span><ChevronRight size={18} /></button>
}

function RiskBadge({ status }: { status: CaseStatus }) {
  return <span className={`risk-badge ${status === 'High risk' ? 'high' : status === 'In review' ? 'review' : 'resolved'}`}>{status}</span>
}

function NetworkScreen({ onDownload }: { onDownload: () => void }) {
  return <>
    <section className="page-title"><p className="eyebrow">SHARED INTELLIGENCE · SAMPLE</p><h2>Campaign network</h2><p>See how related reports connect across the demo workspace.</p></section>
    <section className="network-visual" aria-label="Illustrative linked fraud campaign"><div className="network-lines" /><span className="network-node center"><ShieldAlert size={25} /></span><span className="network-node n1"><Globe2 size={18} /></span><span className="network-node n2"><QrCode size={18} /></span><span className="network-node n3"><MessageSquareText size={18} /></span><span className="network-node n4"><Fingerprint size={18} /></span><div className="network-caption"><strong>KYC impersonation</strong><span>34 reports · 12 linked indicators</span></div></section>
    <section className="section-block"><div className="section-heading"><h3>Reports by input</h3><span>Last 7 days</span></div><div className="bar-chart">{[['Links', 84], ['Messages', 67], ['UPI QR', 49], ['Screenshots', 31]].map(([label, value]) => <div key={label}><span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value}</strong></div>)}</div></section>
    <section className="section-block"><div className="section-heading"><h3>Top observed signals</h3><span>Sample data</span></div><div className="signal-rank"><div><span>01</span><p><strong>Urgency and account blocking</strong><small>72 linked reports</small></p></div><div><span>02</span><p><strong>Lookalike financial brand</strong><small>54 linked reports</small></p></div><div><span>03</span><p><strong>External APK or remote access</strong><small>28 linked reports</small></p></div></div></section>
    <button className="primary-button full" onClick={onDownload}><FileText size={18} />Download intelligence brief</button>
    <p className="demo-disclaimer spaced">Network relationships and counts are illustrative, not live intelligence.</p>
  </>
}

function SettingsScreen({ autoHold, setAutoHold, regionalAlerts, setRegionalAlerts, team, onAdd, onApi, onChannels, onPermissions, onInstall, onExport, onHelp }: any) {
  return <>
    <section className="page-title"><p className="eyebrow">NAMMAPAY · DEMO</p><h2>Workspace settings</h2><p>Policy, people and integration controls.</p></section>
    <section className="settings-group"><h3>Alert policy</h3><ToggleRow icon={LockKeyhole} title="High-risk payment hold" text="Require analyst review above score 80" checked={autoHold} onChange={() => setAutoHold(!autoHold)} /><ToggleRow icon={Bell} title="Regional-language alerts" text="Include Kannada and Hindi advisories" checked={regionalAlerts} onChange={() => setRegionalAlerts(!regionalAlerts)} /></section>
    <section className="settings-group"><div className="section-heading"><h3>Team access</h3><button className="text-button" onClick={onAdd}><Plus size={16} />Invite</button></div>{team.map((member: string) => <div className="team-row" key={member}><span>{member.charAt(0).toUpperCase()}</span><p>{member}</p>{member.includes('Invited') ? <small>Pending</small> : <CheckCircle2 size={17} />}</div>)}</section>
    <section className="settings-group action-list"><h3>Business controls</h3><button onClick={onPermissions}><LockKeyhole size={19} /><span><strong>Message access & permissions</strong><small>Forward-only, notification previews and evidence consent</small></span><ChevronRight size={18} /></button><button onClick={onChannels}><MessageSquareText size={19} /><span><strong>Messaging channels</strong><small>WhatsApp and Telegram integration design</small></span><ChevronRight size={18} /></button><button onClick={onApi}><Activity size={19} /><span><strong>Risk Check API</strong><small>View integration request</small></span><ChevronRight size={18} /></button><button onClick={onExport}><Download size={19} /><span><strong>Export workspace data</strong><small>Cases, people and policy settings</small></span><ChevronRight size={18} /></button><button onClick={onInstall}><Upload size={19} /><span><strong>Install mobile app</strong><small>Add this prototype to your home screen</small></span><ChevronRight size={18} /></button><button onClick={onHelp}><CircleHelp size={19} /><span><strong>Prototype guide</strong><small>What is functional and what is simulated</small></span><ChevronRight size={18} /></button></section>
    <div className="security-footer"><ShieldCheck size={18} /><p><strong>Privacy by design</strong><span>No payment PIN, OTP or full account number should ever be collected.</span></p></div>
    <p><a href="/security">Set up fingerprint or device passcode sign-in</a></p>
    <button onClick={async () => { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); window.location.assign('/login') }}>Sign out</button>
  </>
}

function ToggleRow({ icon: Icon, title, text, checked, onChange }: any) {
  return <div className="toggle-row"><Icon size={19} /><p><strong>{title}</strong><span>{text}</span></p><button className={`switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={title} onClick={onChange}><span /></button></div>
}

function EmptyState({ icon: Icon, title, text }: any) {
  return <div className="empty-state"><Icon size={28} /><strong>{title}</strong><p>{text}</p></div>
}

function Modal({ onClose, title, eyebrow, children }: { onClose: () => void; title: string; eyebrow: string; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => { panelRef.current?.focus() }, [])
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={panelRef}><button className="modal-close" onClick={onClose} aria-label="Close dialog"><X size={20} /></button><p className="eyebrow">{eyebrow}</p><h2 id="modal-title">{title}</h2>{children}</div></div>
}

function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => {
    if (window.location.pathname === '/login') return
    void fetch('/api/auth/me', { credentials: 'same-origin' }).then(response => setSignedIn(response.ok)).catch(() => setSignedIn(false))
  }, [])
  if (window.location.pathname === '/login') return <Login />
  if (signedIn === null) return <div role="status" className="p-6">Checking your session…</div>
  if (!signedIn) { window.location.replace('/login'); return <div role="status" className="p-6">Opening sign-in…</div> }
  if (window.location.pathname === '/security') return <PasskeySettings />
  return <Workspace />
}

export default App
