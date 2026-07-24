import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'

type Service = {
  id: string
  code: string
  name: string
  short_description: string
  intake_fields: Array<{
    key: string
    label: string
    type: 'text' | 'textarea' | 'select' | 'number' | 'date'
    options?: string[]
  }>
}

type ServiceRequest = {
  id: string
  request_number: number
  subject: string
  status: string
  created_at: string
  service_catalog: { name: string } | null
}

type Profile = {
  full_name: string | null
  phone: string | null
  company_name: string | null
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  contacted: 'Contacted',
  documents_needed: 'Documents needed',
  appointment_scheduled: 'Appointment scheduled',
  payment_due: 'Payment due',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState<Service[]>([])
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role, setRole] = useState('customer')
  const [view, setView] = useState<'dashboard' | 'new-request' | 'profile'>('dashboard')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notice, setNotice] = useState('')

  const isStaff = ['staff', 'admin', 'owner'].includes(role)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    loadServices()
  }, [])

  useEffect(() => {
    if (session?.user) loadPortalData(session.user.id)
    else {
      setRequests([])
      setProfile(null)
      setRole('customer')
    }
  }, [session])

  async function loadServices() {
    const { data, error } = await supabase
      .from('service_catalog')
      .select('id,code,name,short_description,intake_fields')
      .eq('is_active', true)
      .order('sort_order')
    if (!error && data) setServices(data as Service[])
  }

  async function loadPortalData(userId: string) {
    const [profileResult, roleResult, requestsResult] = await Promise.all([
      supabase.from('profiles').select('full_name,phone,company_name').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId).single(),
      supabase
        .from('service_requests')
        .select('id,request_number,subject,status,created_at,service_catalog(name)')
        .order('created_at', { ascending: false }),
    ])
    if (profileResult.data) setProfile(profileResult.data)
    if (roleResult.data) setRole(roleResult.data.role)
    if (requestsResult.data) setRequests(requestsResult.data as unknown as ServiceRequest[])
  }

  async function signOut() {
    await supabase.auth.signOut()
    setView('dashboard')
  }

  if (loading) return <div className="screen-loader">Loading LIW Worgs…</div>

  if (!session) {
    return <PublicHome services={services} onAuthenticated={setSession} />
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X /></button>
        <Brand compact />
        <nav>
          <NavButton active={view === 'dashboard'} icon={<LayoutDashboard />} label="Dashboard" onClick={() => navigate('dashboard')} />
          <NavButton active={view === 'new-request'} icon={<Plus />} label="New request" onClick={() => navigate('new-request')} />
          <NavButton active={view === 'profile'} icon={<UserRound />} label="My profile" onClick={() => navigate('profile')} />
          {isStaff && <div className="staff-tag"><ShieldCheck size={17} /> Staff access</div>}
        </nav>
        <button className="signout" onClick={signOut}><LogOut size={18} /> Sign out</button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu /></button>
          <div>
            <span className="eyebrow">LIW Command Center</span>
            <h1>{view === 'dashboard' ? 'Welcome back' : view === 'new-request' ? 'Start a service request' : 'Your profile'}</h1>
          </div>
          <div className="avatar">{(profile?.full_name || session.user.email || 'L').slice(0, 1).toUpperCase()}</div>
        </header>

        {notice && <div className="notice"><CheckCircle2 size={19} /> {notice}</div>}

        {view === 'dashboard' && (
          <Dashboard
            profile={profile}
            requests={requests}
            isStaff={isStaff}
            onNewRequest={() => navigate('new-request')}
          />
        )}

        {view === 'new-request' && (
          <RequestBuilder
            services={services}
            selected={selectedService}
            onSelect={setSelectedService}
            userId={session.user.id}
            onSaved={async () => {
              await loadPortalData(session.user.id)
              setNotice('Your request was submitted successfully. LIW Worgs will follow up soon.')
              setSelectedService(null)
              setView('dashboard')
              window.setTimeout(() => setNotice(''), 5000)
            }}
          />
        )}

        {view === 'profile' && (
          <ProfileForm
            userId={session.user.id}
            email={session.user.email ?? ''}
            profile={profile}
            onSaved={async () => {
              await loadPortalData(session.user.id)
              setNotice('Profile updated.')
              window.setTimeout(() => setNotice(''), 3500)
            }}
          />
        )}
      </main>
    </div>
  )

  function navigate(next: typeof view) {
    setView(next)
    setMobileMenu(false)
    setNotice('')
  }
}

function PublicHome({ services, onAuthenticated }: { services: Service[]; onAuthenticated: (session: Session | null) => void }) {
  const [authOpen, setAuthOpen] = useState(false)
  return (
    <div className="public-site">
      <header className="public-header">
        <Brand />
        <button className="button secondary" onClick={() => setAuthOpen(true)}>Client login</button>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">One company. Connected solutions.</span>
          <h1>Making business and life services easier to manage.</h1>
          <p>Start your request, upload information securely, track progress, and stay connected with LIW Worgs Inc. from one convenient portal.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => setAuthOpen(true)}>Get started <ArrowRight size={18} /></button>
            <a className="text-link" href="#services">Explore services</a>
          </div>
          <div className="trust-row">
            <span><ShieldCheck /> Secure portal</span>
            <span><ClipboardList /> Organized requests</span>
            <span><CalendarDays /> Easy follow-up</span>
          </div>
        </div>
        <div className="hero-card">
          <div className="hero-card-icon"><Building2 /></div>
          <h2>LIW Smart Intake</h2>
          <p>Tell us what you need and the portal creates the right request for your selected service.</p>
          <div className="mini-steps"><span>1</span> Choose a service</div>
          <div className="mini-steps"><span>2</span> Complete your details</div>
          <div className="mini-steps"><span>3</span> Track your progress</div>
        </div>
      </section>
      <section id="services" className="services-section">
        <div className="section-heading">
          <span className="eyebrow">Services</span>
          <h2>How LIW Worgs can help</h2>
        </div>
        <div className="service-grid">
          {services.map((service) => (
            <article className="service-card" key={service.id}>
              <div className="service-icon"><FileText /></div>
              <h3>{service.name}</h3>
              <p>{service.short_description}</p>
              <button onClick={() => setAuthOpen(true)}>Start request <ArrowRight size={16} /></button>
            </article>
          ))}
        </div>
      </section>
      <footer>© {new Date().getFullYear()} LIW Worgs Inc. · Brooklyn, New York</footer>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthenticated={onAuthenticated} />}
    </div>
  )
}

function AuthModal({ onClose }: { onClose: () => void; onAuthenticated: (session: Session | null) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    const fullName = String(form.get('fullName') || '').trim()
    const phone = String(form.get('phone') || '').trim()

    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone } } })

    setBusy(false)
    if (result.error) return setMessage(result.error.message)
    if (mode === 'signup' && !result.data.session) {
      setMessage('Account created. Check your email to confirm your account, then return to log in.')
      setMode('login')
      return
    }
    onAuthenticated(result.data.session)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="auth-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
        <Brand compact />
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p>{mode === 'login' ? 'Sign in to access your requests and documents.' : 'Create one secure account for all LIW Worgs services.'}</p>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="form-row two">
              <label>Full name<input name="fullName" required /></label>
              <label>Phone<input name="phone" type="tel" required /></label>
            </div>
          )}
          <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
          {message && <div className="form-message">{message}</div>}
          <button className="button primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="switch-auth" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
          {mode === 'login' ? 'New to LIW Worgs? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

function Dashboard({ profile, requests, isStaff, onNewRequest }: { profile: Profile | null; requests: ServiceRequest[]; isStaff: boolean; onNewRequest: () => void }) {
  const active = requests.filter((request) => !['completed', 'closed'].includes(request.status)).length
  const completed = requests.filter((request) => request.status === 'completed').length
  return (
    <div className="content-wrap">
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">Customer workspace</span>
          <h2>{profile?.full_name ? `Hello, ${profile.full_name.split(' ')[0]}` : 'Your LIW portal is ready'}</h2>
          <p>Manage every LIW Worgs request from one place. Start a service, monitor updates, and keep your information organized.</p>
        </div>
        <button className="button primary" onClick={onNewRequest}><Plus size={18} /> New request</button>
      </section>
      <section className="stats-grid">
        <StatCard label="Total requests" value={requests.length} icon={<ClipboardList />} />
        <StatCard label="Active services" value={active} icon={<LayoutDashboard />} />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 />} />
        <StatCard label="Account type" value={isStaff ? 'Staff' : 'Client'} icon={<ShieldCheck />} />
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Recent activity</span><h2>Your service requests</h2></div></div>
        {requests.length === 0 ? (
          <div className="empty-state"><ClipboardList /><h3>No requests yet</h3><p>Start your first LIW Worgs service request.</p><button className="button primary" onClick={onNewRequest}>Start now</button></div>
        ) : (
          <div className="request-list">
            {requests.map((request) => (
              <article key={request.id} className="request-row">
                <div className="request-number">#{String(request.request_number).padStart(5, '0')}</div>
                <div className="request-main"><strong>{request.subject}</strong><span>{request.service_catalog?.name ?? 'LIW Service'} · {new Date(request.created_at).toLocaleDateString()}</span></div>
                <span className={`status status-${request.status}`}>{statusLabels[request.status] ?? request.status}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function RequestBuilder({ services, selected, onSelect, userId, onSaved }: { services: Service[]; selected: Service | null; onSelect: (service: Service | null) => void; userId: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const details: Record<string, string> = {}
    selected.intake_fields.forEach((field) => { details[field.key] = String(form.get(field.key) || '') })
    const subject = String(form.get('subject') || `${selected.name} request`).trim()
    const { error: saveError } = await supabase.from('service_requests').insert({
      user_id: userId,
      service_id: selected.id,
      subject,
      details,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    setBusy(false)
    if (saveError) return setError(saveError.message)
    onSaved()
  }

  if (!selected) {
    return (
      <div className="content-wrap">
        <div className="section-heading left"><span className="eyebrow">Step 1 of 2</span><h2>Choose the service you need</h2><p>The form will adjust automatically for your selection.</p></div>
        <div className="service-grid portal-grid">
          {services.map((service) => (
            <button className="service-card selectable" key={service.id} onClick={() => onSelect(service)}>
              <div className="service-icon"><FileText /></div><h3>{service.name}</h3><p>{service.short_description}</p><span>Continue <ArrowRight size={16} /></span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="content-wrap narrow">
      <button className="back-link" onClick={() => onSelect(null)}>← Choose another service</button>
      <section className="panel form-panel">
        <span className="eyebrow">Step 2 of 2</span><h2>{selected.name}</h2><p>{selected.short_description}</p>
        <form onSubmit={submit} className="intake-form">
          <label>Request title<input name="subject" placeholder={`Example: New ${selected.name} request`} required /></label>
          {selected.intake_fields.map((field) => (
            <label key={field.key}>{field.label}
              {field.type === 'textarea' ? <textarea name={field.key} rows={4} required /> : field.type === 'select' ? (
                <select name={field.key} required><option value="">Select an option</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
              ) : <input name={field.key} type={field.type} required />}
            </label>
          ))}
          {error && <div className="form-message">{error}</div>}
          <button className="button primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'} <ArrowRight size={18} /></button>
        </form>
      </section>
    </div>
  )
}

function ProfileForm({ userId, email, profile, onSaved }: { userId: string; email: string; profile: Profile | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const { error: saveError } = await supabase.from('profiles').update({
      full_name: String(form.get('fullName') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      company_name: String(form.get('companyName') || '').trim() || null,
      preferred_contact: String(form.get('preferredContact') || 'email'),
    }).eq('id', userId)
    setBusy(false)
    if (saveError) return setError(saveError.message)
    setError('')
    onSaved()
  }
  return (
    <div className="content-wrap narrow">
      <section className="panel form-panel">
        <span className="eyebrow">Account settings</span><h2>Contact information</h2><p>Keep this information updated so LIW Worgs can reach you.</p>
        <form onSubmit={submit} className="intake-form">
          <label>Email address<input value={email} disabled /></label>
          <label>Full name<input name="fullName" defaultValue={profile?.full_name ?? ''} required /></label>
          <label>Phone number<input name="phone" type="tel" defaultValue={profile?.phone ?? ''} required /></label>
          <label>Company name <small>optional</small><input name="companyName" defaultValue={profile?.company_name ?? ''} /></label>
          <label>Preferred contact<select name="preferredContact" defaultValue="email"><option value="email">Email</option><option value="phone">Phone call</option><option value="text">Text message</option></select></label>
          {error && <div className="form-message">{error}</div>}
          <button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>
      </section>
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}><img src="/liw-worgs-logo.png" alt="LIW Worgs Inc." /></div>
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return <article className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></article>
}

export default App
