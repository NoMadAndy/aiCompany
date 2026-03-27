'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { Users, BarChart3, Briefcase } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEmployees(d.employees || []))
  }, [])

  const departments = [...new Set(employees.map(e => e.department))]

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Users className="text-indigo-400" />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Mitarbeiter
              </span>
            </h1>
            <p className="text-[var(--text-secondary)] mb-8">{employees.length} Mitarbeiter in {departments.length} Abteilungen</p>

            {departments.map(dept => (
              <div key={dept} className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Briefcase size={18} className="text-indigo-400" />
                  {dept}
                </h2>
                <div className="glass rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-[var(--text-secondary)] border-b border-[var(--border)]">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Rolle</th>
                        <th className="px-4 py-3 hidden sm:table-cell">Skills</th>
                        <th className="px-4 py-3">Tasks</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.filter(e => e.department === dept).map(emp => {
                        const skills = typeof emp.skills === 'string' ? JSON.parse(emp.skills) : emp.skills
                        return (
                          <tr key={emp.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)] transition-colors">
                            <td className="px-4 py-3 font-medium">{emp.name}</td>
                            <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{emp.role}</td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {(skills || []).slice(0, 3).map((s: string) => (
                                  <span key={s} className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-xs">{s}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">{emp.completed_tasks || 0}/{emp.total_tasks || 0}</td>
                            <td className="px-4 py-3">
                              <span className={cn('px-2 py-0.5 rounded-full text-xs',
                                emp.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                              )}>
                                {emp.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
