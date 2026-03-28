'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { useAuth } from '@/components/AuthProvider'
import {
  Settings, Server, Database, Globe, Key, Users, Shield,
  Plus, Trash2, Edit3, Save, X, Eye, EyeOff, Brain, Cpu
} from 'lucide-react'

type Tab = 'general' | 'apikeys' | 'users' | 'system'

interface UserRow {
  id: number
  email: string
  name: string
  role: string
  last_login: string | null
  created_at: string
  api_keys: { name: string; created_at: string; key_preview: string }[]
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth()
  const [tab, setTab] = useState<Tab>('general')
  const [status, setStatus] = useState<any>(null)
  const [version, setVersion] = useState<any>(null)
  const [aiStatus, setAiStatus] = useState<any>(null)

  // Users state
  const [users, setUsers] = useState<UserRow[]>([])
  const [showUserForm, setShowUserForm] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [userForm, setUserForm] = useState({ email: '', name: '', password: '', role: 'viewer' })

  // API Keys state
  const [apiKeyForm, setApiKeyForm] = useState({ name: '', key: '' })
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus).catch(() => {})
    fetch('/version.json').then(r => r.json()).then(setVersion).catch(() => {})
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) setUsers(await res.json())
    } catch {}
  }, [])

  const loadAiStatus = useCallback(async () => {
    try {
      const workerUrl = '/api/status'
      const res = await fetch(workerUrl)
      if (res.ok) {
        const data = await res.json()
        setAiStatus(data)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'system') loadAiStatus()
  }, [tab, loadUsers, loadAiStatus])

  const isAdmin = currentUser?.role === 'admin'

  // User CRUD
  const saveUser = async () => {
    try {
      if (editUser) {
        const body: any = { name: userForm.name, email: userForm.email, role: userForm.role }
        if (userForm.password) body.password = userForm.password
        await fetch(`/api/users/${editUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userForm),
        })
      }
      setShowUserForm(false)
      setEditUser(null)
      setUserForm({ email: '', name: '', password: '', role: 'viewer' })
      loadUsers()
    } catch {}
  }

  const deleteUser = async (id: number) => {
    if (!confirm('Benutzer wirklich löschen?')) return
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
    loadUsers()
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'general', label: 'Allgemein', icon: Server },
    { key: 'apikeys', label: 'API-Schlüssel', icon: Key },
    { key: 'users', label: 'Benutzer', icon: Users },
    { key: 'system', label: 'System', icon: Database },
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

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-[var(--bg-secondary)] rounded-lg p-1 overflow-x-auto">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                    tab === t.key
                      ? 'bg-indigo-600 text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <t.icon size={16} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* ─── Allgemein ─── */}
            {tab === 'general' && (
              <div className="space-y-6">
                <div className="glass rounded-xl p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Server size={18} className="text-indigo-400" />
                    System-Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard label="Version" value={`${version?.version || '...'} (${version?.codename || ''})`} />
                    <InfoCard label="Build-Datum" value={version?.buildDate || '...'} />
                    <InfoCard label="Uptime" value={status?.uptime ? `${Math.floor(status.uptime / 60)}m` : '...'} />
                    <InfoCard label="GPU" value={status?.gpu || '...'} />
                    <InfoCard label="Angemeldet als" value={currentUser?.name || '...'} />
                    <InfoCard label="Rolle" value={currentUser?.role || '...'} />
                  </div>
                </div>

                <div className="glass rounded-xl p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Globe size={18} className="text-indigo-400" />
                    Endpoints
                  </h3>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="p-2 rounded bg-[var(--bg-primary)]">
                      <span className="text-[var(--text-secondary)]">App:</span> https://aicompany.macherwerkstatt.cc
                    </div>
                    <div className="p-2 rounded bg-[var(--bg-primary)]">
                      <span className="text-[var(--text-secondary)]">API:</span> https://aicompany.macherwerkstatt.cc/api
                    </div>
                    <div className="p-2 rounded bg-[var(--bg-primary)]">
                      <span className="text-[var(--text-secondary)]">Worker:</span> http://worker:8080
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── API-Schlüssel ─── */}
            {tab === 'apikeys' && (
              <div className="space-y-6">
                <div className="glass rounded-xl p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Key size={18} className="text-indigo-400" />
                    API-Schlüssel verwalten
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Hier kannst du API-Schlüssel für externe Dienste hinterlegen.
                    Die Schlüssel werden verschlüsselt gespeichert.
                  </p>

                  {/* Existing keys */}
                  <div className="space-y-3 mb-6">
                    {['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'HUGGINGFACE_TOKEN'].map(keyName => (
                      <div key={keyName} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-primary)]">
                        <div>
                          <div className="font-medium text-sm">{keyName}</div>
                          <div className="text-xs text-[var(--text-secondary)]">
                            {keyName === 'ANTHROPIC_API_KEY' ? 'Claude API (primäres KI-Backend)' :
                             keyName === 'OPENAI_API_KEY' ? 'OpenAI (optional)' :
                             'Hugging Face (Modelle)'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[var(--text-secondary)]">
                            {showKey[keyName] ? '(aus .env)' : '••••••••'}
                          </span>
                          <button
                            onClick={() => setShowKey(s => ({ ...s, [keyName]: !s[keyName] }))}
                            className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                          >
                            {showKey[keyName] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add custom key */}
                  <div className="border-t border-[var(--border)] pt-4">
                    <h4 className="text-sm font-medium mb-3">Eigenen Schlüssel hinzufügen</h4>
                    <div className="flex gap-3">
                      <input
                        value={apiKeyForm.name}
                        onChange={e => setApiKeyForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Bezeichnung (z.B. MY_API_KEY)"
                        className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        value={apiKeyForm.key}
                        onChange={e => setApiKeyForm(f => ({ ...f, key: e.target.value }))}
                        type="password"
                        placeholder="Schlüsselwert"
                        className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition flex items-center gap-2"
                      >
                        <Plus size={14} /> Speichern
                      </button>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-xl p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Brain size={18} className="text-indigo-400" />
                    KI-Modell Konfiguration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
                      <div className="text-xs text-[var(--text-secondary)] mb-1">Primäres Modell (Claude API)</div>
                      <div className="font-mono text-sm">claude-sonnet-4-20250514</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
                      <div className="text-xs text-[var(--text-secondary)] mb-1">Lokales GPU-Modell</div>
                      <div className="font-mono text-sm">Qwen/Qwen2.5-3B-Instruct</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
                      <div className="text-xs text-[var(--text-secondary)] mb-1">Fallback-Reihenfolge</div>
                      <div className="text-sm">Claude API → GPU-Modell → CPU</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
                      <div className="text-xs text-[var(--text-secondary)] mb-1">Max Tokens</div>
                      <div className="font-mono text-sm">2048 (Claude) / 1024 (Lokal)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Benutzer ─── */}
            {tab === 'users' && (
              <div className="space-y-6">
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Shield size={18} className="text-indigo-400" />
                      Benutzerverwaltung
                    </h3>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setEditUser(null)
                          setUserForm({ email: '', name: '', password: '', role: 'viewer' })
                          setShowUserForm(true)
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition flex items-center gap-2"
                      >
                        <Plus size={14} /> Neuer Benutzer
                      </button>
                    )}
                  </div>

                  {/* User Form Modal */}
                  {showUserForm && (
                    <div className="mb-6 p-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                      <h4 className="font-medium mb-3">
                        {editUser ? `${editUser.name} bearbeiten` : 'Neuen Benutzer anlegen'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          value={userForm.name}
                          onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Name"
                          className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          value={userForm.email}
                          onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="E-Mail"
                          type="email"
                          className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          value={userForm.password}
                          onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                          placeholder={editUser ? 'Neues Passwort (leer = beibehalten)' : 'Passwort'}
                          type="password"
                          className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <select
                          value={userForm.role}
                          onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                          className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="viewer">Betrachter</option>
                        </select>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={saveUser}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition flex items-center gap-2"
                        >
                          <Save size={14} /> Speichern
                        </button>
                        <button
                          onClick={() => { setShowUserForm(false); setEditUser(null) }}
                          className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-lg text-sm font-medium transition flex items-center gap-2"
                        >
                          <X size={14} /> Abbrechen
                        </button>
                      </div>
                    </div>
                  )}

                  {/* User Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-3 px-3 text-[var(--text-secondary)] font-medium">Name</th>
                          <th className="text-left py-3 px-3 text-[var(--text-secondary)] font-medium">E-Mail</th>
                          <th className="text-left py-3 px-3 text-[var(--text-secondary)] font-medium">Rolle</th>
                          <th className="text-left py-3 px-3 text-[var(--text-secondary)] font-medium">Letzter Login</th>
                          {isAdmin && <th className="text-right py-3 px-3 text-[var(--text-secondary)] font-medium">Aktionen</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-hover)]">
                            <td className="py-3 px-3 font-medium">{u.name}</td>
                            <td className="py-3 px-3 text-[var(--text-secondary)]">{u.email}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400' :
                                u.role === 'manager' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-gray-500/10 text-gray-400'
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
                                  <button
                                    onClick={() => {
                                      setEditUser(u)
                                      setUserForm({ email: u.email, name: u.name, password: '', role: u.role })
                                      setShowUserForm(true)
                                    }}
                                    className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-indigo-400"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  {u.id !== 1 && (
                                    <button
                                      onClick={() => deleteUser(u.id)}
                                      className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-red-400"
                                    >
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

            {/* ─── System ─── */}
            {tab === 'system' && (
              <div className="space-y-6">
                <div className="glass rounded-xl p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Database size={18} className="text-indigo-400" />
                    Services
                  </h3>
                  <div className="space-y-3">
                    {[
                      { name: 'Next.js Frontend', port: '3002' },
                      { name: 'Python AI Worker', port: '8080' },
                      { name: 'PostgreSQL 16', port: '5432' },
                      { name: 'Redis 7', port: '6379' },
                      { name: 'File Watcher', port: '-' },
                    ].map(s => (
                      <div key={s.name} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-primary)]">
                        <div>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-[var(--text-secondary)] ml-2">Port {s.port}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400">Aktiv</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-xl p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Cpu size={18} className="text-indigo-400" />
                    KI-Engine Status
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard label="Claude API" value={aiStatus?.claude_api || '...'} />
                    <InfoCard label="Lokales Modell" value={aiStatus?.local_model || '...'} />
                    <InfoCard label="GPU" value={aiStatus?.gpu_device || 'Nicht verfügbar'} />
                    <InfoCard label="VRAM" value={aiStatus?.gpu_vram_used ? `${aiStatus.gpu_vram_used} / ${aiStatus.gpu_vram_total}` : '...'} />
                    <InfoCard label="Aktives Backend" value={aiStatus?.active_backend || '...'} />
                    <InfoCard label="Modellname" value={aiStatus?.local_model_name || '...'} />
                  </div>
                </div>

                <div className="glass rounded-xl p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Server size={18} className="text-indigo-400" />
                    Konfiguration (.env)
                  </h3>
                  <div className="space-y-2 text-sm font-mono">
                    {[
                      'FRONTEND_PORT', 'WORKER_PORT', 'LOCAL_MODEL',
                      'POSTGRES_DB', 'REDIS_URL',
                    ].map(key => (
                      <div key={key} className="flex justify-between p-2 rounded bg-[var(--bg-primary)]">
                        <span className="text-[var(--text-secondary)]">{key}</span>
                        <span className="text-indigo-300">aus .env</span>
                      </div>
                    ))}
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="font-mono text-sm mt-0.5">{value}</div>
    </div>
  )
}
