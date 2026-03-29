'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { useAuth } from '@/components/AuthProvider'
import {
  Settings, Server, Database, Globe, Key, Users, Shield,
  Plus, Trash2, Edit3, Save, X, Eye, EyeOff, Brain, Cpu,
  Check, AlertCircle, Sliders
} from 'lucide-react'

type Tab = 'general' | 'apikeys' | 'users' | 'system'

interface UserRow {
  id: number; email: string; name: string; role: string
  last_login: string | null; created_at: string
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth()
  const [tab, setTab] = useState<Tab>('general')
  const [status, setStatus] = useState<any>(null)
  const [version, setVersion] = useState<any>(null)
  const [aiStatus, setAiStatus] = useState<any>(null)
  const [toast, setToast] = useState('')

  // Users
  const [users, setUsers] = useState<UserRow[]>([])
  const [showUserForm, setShowUserForm] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [userForm, setUserForm] = useState({ email: '', name: '', password: '', role: 'viewer' })

  // API Keys
  const [savedKeys, setSavedKeys] = useState<{ name: string; has_value: boolean; created_at: string }[]>([])
  const [keyForm, setKeyForm] = useState({ name: '', value: '' })
  const [showValues, setShowValues] = useState<Record<string, boolean>>({})

  // Settings overrides
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [savingSettings, setSavingSettings] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus).catch(() => {})
    fetch('/version.json').then(r => r.json()).then(setVersion).catch(() => {})
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSavedKeys(data.api_keys || [])
        setOverrides(data.settings || {})
      }
    } catch {}
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) setUsers(await res.json())
    } catch {}
  }, [])

  const loadAiStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status')
      if (res.ok) setAiStatus(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    if (tab === 'apikeys') loadSettings()
    if (tab === 'users') loadUsers()
    if (tab === 'system') loadAiStatus()
  }, [tab, loadSettings, loadUsers, loadAiStatus])

  const isAdmin = currentUser?.role === 'admin'

  // API Key actions
  const saveApiKey = async () => {
    if (!keyForm.name || !keyForm.value) return
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_key', name: keyForm.name, value: keyForm.value }),
    })
    if (res.ok) {
      showToast(`${keyForm.name} gespeichert`)
      setKeyForm({ name: '', value: '' })
      loadSettings()
    }
  }

  const deleteApiKey = async (name: string) => {
    if (!confirm(`"${name}" wirklich löschen?`)) return
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_key', name }),
    })
    showToast(`${name} gelöscht`)
    loadSettings()
  }

  // Settings override save
  const saveOverrides = async () => {
    setSavingSettings(true)
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_settings', settings: overrides }),
    })
    setSavingSettings(false)
    if (res.ok) showToast('Einstellungen gespeichert')
  }

  // User CRUD
  const saveUser = async () => {
    try {
      if (editUser) {
        const body: any = { name: userForm.name, email: userForm.email, role: userForm.role }
        if (userForm.password) body.password = userForm.password
        await fetch(`/api/users/${editUser.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      } else {
        await fetch('/api/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userForm),
        })
      }
      setShowUserForm(false)
      setEditUser(null)
      setUserForm({ email: '', name: '', password: '', role: 'viewer' })
      loadUsers()
      showToast(editUser ? 'Benutzer aktualisiert' : 'Benutzer erstellt')
    } catch {}
  }

  const deleteUser = async (id: number) => {
    if (!confirm('Benutzer wirklich löschen?')) return
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
    loadUsers()
    showToast('Benutzer gelöscht')
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'general', label: 'Allgemein', icon: Server },
    { key: 'apikeys', label: 'API-Schlüssel', icon: Key },
    { key: 'users', label: 'Benutzer', icon: Users },
    { key: 'system', label: 'System', icon: Database },
  ]

  const WELL_KNOWN_KEYS = [
    { name: 'ANTHROPIC_API_KEY', desc: 'Claude API — primäres KI-Backend' },
    { name: 'OPENAI_API_KEY', desc: 'OpenAI — optional' },
    { name: 'HUGGINGFACE_TOKEN', desc: 'Hugging Face — Modelle' },
  ]

  const ENV_OVERRIDES = [
    { key: 'FRONTEND_PORT', label: 'Frontend Port', default: '3002' },
    { key: 'WORKER_PORT', label: 'Worker Port', default: '8080' },
    { key: 'LOCAL_MODEL', label: 'Lokales KI-Modell', default: 'Qwen/Qwen2.5-3B-Instruct' },
    { key: 'NEXT_PUBLIC_APP_URL', label: 'App URL', default: 'https://aicompany.macherwerkstatt.cc' },
  ]

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Settings className="text-indigo-400" />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Einstellungen
              </span>
            </h1>

            {/* Toast */}
            {toast && (
              <div className="fixed top-4 right-4 z-50 glass-elevated rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm animate-fade-in">
                <Check size={16} className="text-green-400" />
                {toast}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 glass-subtle rounded-lg p-1 overflow-x-auto">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                    tab === t.key
                      ? 'bg-indigo-600/80 text-white shadow-lg shadow-indigo-500/20'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)]'
                  }`}
                >
                  <t.icon size={16} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* ─── ALLGEMEIN ─── */}
            {tab === 'general' && (
              <div className="space-y-6 animate-fade-in">
                <div className="glass rounded-xl p-5 card-hover">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Server size={18} className="text-indigo-400" />
                    System-Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <InfoCard label="Version" value={`${version?.version || '...'} "${version?.codename || ''}"`} accent />
                    <InfoCard label="Build-Datum" value={version?.buildDate || '...'} />
                    <InfoCard label="Uptime" value={status?.uptime ? `${Math.floor(status.uptime / 60)}m` : '...'} />
                    <InfoCard label="GPU" value={status?.gpu || '...'} />
                    <InfoCard label="Angemeldet als" value={currentUser?.name || '...'} />
                    <InfoCard label="Rolle" value={currentUser?.role === 'admin' ? 'Administrator' : currentUser?.role || '...'} />
                  </div>
                </div>

                {/* .env Override */}
                <div className="glass rounded-xl p-5 card-hover">
                  <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                    <Sliders size={18} className="text-indigo-400" />
                    Konfiguration
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-4">
                    Überschreibt die .env Einstellungen pro Benutzer.
                  </p>
                  <div className="space-y-3">
                    {ENV_OVERRIDES.map(o => (
                      <div key={o.key} className="flex items-center gap-3">
                        <label className="text-sm text-[var(--text-secondary)] w-40 shrink-0">{o.label}</label>
                        <input
                          value={overrides[o.key] || ''}
                          onChange={e => setOverrides(prev => ({ ...prev, [o.key]: e.target.value }))}
                          placeholder={o.default}
                          className="flex-1 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500/50 transition placeholder:text-[var(--text-tertiary)]"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={saveOverrides}
                      disabled={savingSettings}
                      className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 rounded-lg text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save size={14} /> {savingSettings ? 'Speichern...' : 'Übernehmen'}
                    </button>
                  </div>
                </div>

                <div className="glass rounded-xl p-5 card-hover">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Globe size={18} className="text-indigo-400" />
                    Endpoints
                  </h3>
                  <div className="space-y-2 font-mono text-sm">
                    {[
                      { label: 'App', url: 'https://aicompany.macherwerkstatt.cc' },
                      { label: 'API', url: 'https://aicompany.macherwerkstatt.cc/api' },
                      { label: 'Worker', url: 'http://worker:8080' },
                    ].map(e => (
                      <div key={e.label} className="flex items-center gap-3 p-2.5 rounded-lg bg-[rgba(0,0,0,0.2)]">
                        <span className="text-[var(--text-tertiary)] w-16">{e.label}</span>
                        <span className="text-indigo-300">{e.url}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── API-SCHLÜSSEL ─── */}
            {tab === 'apikeys' && (
              <div className="space-y-6 animate-fade-in">
                <div className="glass rounded-xl p-5 card-hover">
                  <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                    <Key size={18} className="text-indigo-400" />
                    API-Schlüssel
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-4">
                    Verschlüsselt gespeichert (AES-256-GCM). Klicke auf einen Schlüssel um ihn zu aktualisieren.
                  </p>

                  <div className="space-y-2 mb-6">
                    {WELL_KNOWN_KEYS.map(wk => {
                      const saved = savedKeys.find(k => k.name === wk.name)
                      return (
                        <div key={wk.name} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(0,0,0,0.2)] group">
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {wk.name}
                              {saved?.has_value && <Check size={14} className="text-green-400" />}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">{wk.desc}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setKeyForm({ name: wk.name, value: '' })}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition"
                            >
                              {saved?.has_value ? 'Ändern' : 'Setzen'}
                            </button>
                            {saved?.has_value && (
                              <button
                                onClick={() => deleteApiKey(wk.name)}
                                className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {/* Custom saved keys */}
                    {savedKeys.filter(k => !WELL_KNOWN_KEYS.find(wk => wk.name === k.name)).map(k => (
                      <div key={k.name} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(0,0,0,0.2)]">
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {k.name}
                            <Check size={14} className="text-green-400" />
                          </div>
                          <div className="text-xs text-[var(--text-secondary)]">Eigener Schlüssel</div>
                        </div>
                        <button
                          onClick={() => deleteApiKey(k.name)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Key Input Form */}
                  <div className="border-t border-[var(--border)] pt-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Plus size={14} className="text-indigo-400" />
                      {keyForm.name ? `${keyForm.name} setzen` : 'Neuen Schlüssel hinzufügen'}
                    </h4>
                    <div className="flex gap-3">
                      <input
                        value={keyForm.name}
                        onChange={e => setKeyForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Bezeichnung (z.B. MY_API_KEY)"
                        className="flex-1 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500/50 transition placeholder:text-[var(--text-tertiary)]"
                      />
                      <input
                        value={keyForm.value}
                        onChange={e => setKeyForm(f => ({ ...f, value: e.target.value }))}
                        type="password"
                        placeholder="Schlüsselwert"
                        className="flex-1 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500/50 transition placeholder:text-[var(--text-tertiary)]"
                      />
                      <button
                        onClick={saveApiKey}
                        disabled={!keyForm.name || !keyForm.value}
                        className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 rounded-lg text-sm font-medium transition flex items-center gap-2 disabled:opacity-30"
                      >
                        <Save size={14} /> Speichern
                      </button>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-xl p-5 card-hover">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Brain size={18} className="text-indigo-400" />
                    KI-Modell Konfiguration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InfoCard label="Primäres Modell (Claude)" value="claude-sonnet-4-20250514" accent />
                    <InfoCard label="Lokales GPU-Modell" value="Qwen/Qwen2.5-3B-Instruct" />
                    <InfoCard label="Fallback" value="Claude → GPU → CPU" />
                    <InfoCard label="Max Tokens" value="2048 / 1024 (lokal)" />
                  </div>
                </div>
              </div>
            )}

            {/* ─── BENUTZER ─── */}
            {tab === 'users' && (
              <div className="space-y-6 animate-fade-in">
                <div className="glass rounded-xl p-5 card-hover">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Shield size={18} className="text-indigo-400" />
                      Benutzerverwaltung
                    </h3>
                    {isAdmin && (
                      <button
                        onClick={() => { setEditUser(null); setUserForm({ email: '', name: '', password: '', role: 'viewer' }); setShowUserForm(true) }}
                        className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 rounded-lg text-sm font-medium transition flex items-center gap-2"
                      >
                        <Plus size={14} /> Neuer Benutzer
                      </button>
                    )}
                  </div>

                  {showUserForm && (
                    <div className="mb-6 p-4 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[var(--border)] animate-fade-in">
                      <h4 className="font-medium mb-3">{editUser ? `${editUser.name} bearbeiten` : 'Neuen Benutzer anlegen'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} placeholder="Name"
                          className="bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition" />
                        <input value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="E-Mail" type="email"
                          className="bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition" />
                        <input value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder={editUser ? 'Neues Passwort (leer = beibehalten)' : 'Passwort'} type="password"
                          className="bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition" />
                        <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                          className="bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition">
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="viewer">Betrachter</option>
                        </select>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={saveUser} className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 rounded-lg text-sm font-medium transition flex items-center gap-2">
                          <Save size={14} /> Speichern
                        </button>
                        <button onClick={() => { setShowUserForm(false); setEditUser(null) }} className="px-4 py-2 glass-subtle hover:bg-[rgba(255,255,255,0.05)] rounded-lg text-sm font-medium transition flex items-center gap-2">
                          <X size={14} /> Abbrechen
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-3 px-3 text-micro">Name</th>
                          <th className="text-left py-3 px-3 text-micro">E-Mail</th>
                          <th className="text-left py-3 px-3 text-micro">Rolle</th>
                          <th className="text-left py-3 px-3 text-micro">Letzter Login</th>
                          {isAdmin && <th className="text-right py-3 px-3 text-micro">Aktionen</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.03)] transition">
                            <td className="py-3 px-3 font-medium">{u.name}</td>
                            <td className="py-3 px-3 text-[var(--text-secondary)] font-mono text-xs">{u.email}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                u.role === 'admin' ? 'bg-indigo-500/15 text-indigo-400' :
                                u.role === 'manager' ? 'bg-amber-500/15 text-amber-400' :
                                'bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)]'
                              }`}>
                                {u.role === 'admin' ? 'Admin' : u.role === 'manager' ? 'Manager' : 'Betrachter'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[var(--text-secondary)] text-xs">
                              {u.last_login ? new Date(u.last_login).toLocaleString('de') : 'Nie'}
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-3 text-right">
                                <div className="flex gap-1 justify-end">
                                  <button onClick={() => { setEditUser(u); setUserForm({ email: u.email, name: u.name, password: '', role: u.role }); setShowUserForm(true) }}
                                    className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)] hover:text-indigo-400 transition">
                                    <Edit3 size={14} />
                                  </button>
                                  {u.id !== 1 && (
                                    <button onClick={() => deleteUser(u.id)}
                                      className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition">
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ─── SYSTEM ─── */}
            {tab === 'system' && (
              <div className="space-y-6 animate-fade-in">
                <div className="glass rounded-xl p-5 card-hover">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Database size={18} className="text-indigo-400" />
                    Services
                  </h3>
                  <div className="space-y-2">
                    {[
                      { name: 'Next.js Frontend', port: '3002', icon: '▲' },
                      { name: 'Python AI Worker', port: '8080', icon: '🐍' },
                      { name: 'PostgreSQL 16', port: '5432', icon: '🐘' },
                      { name: 'Redis 7', port: '6379', icon: '⚡' },
                    ].map(s => (
                      <div key={s.name} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(0,0,0,0.2)]">
                        <div className="flex items-center gap-3">
                          <span className="text-base">{s.icon}</span>
                          <div>
                            <span className="font-medium text-sm">{s.name}</span>
                            <span className="text-xs text-[var(--text-tertiary)] ml-2">:{s.port}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="status-dot status-online pulse" />
                          <span className="text-xs text-green-400">Aktiv</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-xl p-5 card-hover">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Cpu size={18} className="text-indigo-400" />
                    KI-Engine
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InfoCard label="Claude API" value={aiStatus?.claude_api || '...'} accent={aiStatus?.claude_api === 'available'} />
                    <InfoCard label="Lokales Modell" value={aiStatus?.local_model || 'nicht geladen'} />
                    <InfoCard label="GPU" value={aiStatus?.gpu || 'Nicht verfügbar'} />
                    <InfoCard label="VRAM" value={aiStatus?.vram_used ? `${aiStatus.vram_used} / ${aiStatus.vram_total}` : '...'} />
                    <InfoCard label="Aktives Backend" value={aiStatus?.active_backend || '...'} accent />
                    <InfoCard label="Modellname" value={aiStatus?.local_model_name || '...'} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}

function InfoCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.2)]">
      <div className="text-micro mb-1">{label}</div>
      <div className={`font-mono text-sm ${accent ? 'text-indigo-300' : ''}`}>{value}</div>
    </div>
  )
}
