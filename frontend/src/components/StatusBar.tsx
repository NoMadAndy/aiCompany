'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Cpu, HardDrive, Clock } from 'lucide-react'

export default function StatusBar() {
  const [connected, setConnected] = useState(false)
  const [time, setTime] = useState('')
  const [status, setStatus] = useState({ cpu: 0, gpu: 'idle', tasks: 0 })

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('de-DE'))
    }, 1000)

    // Check connection
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/status')
        if (res.ok) {
          const data = await res.json()
          setConnected(true)
          setStatus(data)
        }
      } catch {
        setConnected(false)
      }
    }
    checkStatus()
    const statusInterval = setInterval(checkStatus, 5000)

    return () => { clearInterval(timer); clearInterval(statusInterval) }
  }, [])

  return (
    <div className="h-8 bg-[var(--bg-secondary)] border-t border-[var(--border)] flex items-center px-4 text-xs text-[var(--text-secondary)] gap-4">
      <div className="flex items-center gap-1.5">
        {connected ? (
          <><Wifi size={12} className="text-green-400" /><span className="text-green-400">Verbunden</span></>
        ) : (
          <><WifiOff size={12} className="text-red-400" /><span className="text-red-400">Offline</span></>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Cpu size={12} />
        <span>GPU: {status.gpu}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <HardDrive size={12} />
        <span>{status.tasks} Tasks</span>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <Clock size={12} />
        <span>{time}</span>
      </div>
    </div>
  )
}
