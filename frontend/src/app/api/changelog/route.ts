import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

interface ParsedVersion {
  version: string
  date: string
  sections: Array<{ type: string; items: string[] }>
}

function parseChangelog(md: string): ParsedVersion[] {
  const versions: ParsedVersion[] = []
  const lines = md.split('\n')
  let current: ParsedVersion | null = null
  let currentSection: { type: string; items: string[] } | null = null

  for (const line of lines) {
    // Match version header: ## [0.3.0] - 2026-03-27
    const versionMatch = line.match(/^## \[(\d+\.\d+\.\d+)\]\s*-\s*(.+)/)
    if (versionMatch) {
      if (current) versions.push(current)
      current = { version: versionMatch[1], date: versionMatch[2].trim(), sections: [] }
      currentSection = null
      continue
    }

    // Match section header: ### Hinzugefügt
    const sectionMatch = line.match(/^### (.+)/)
    if (sectionMatch && current) {
      const typeMap: Record<string, string> = {
        'Hinzugefügt': 'added',
        'Added': 'added',
        'Geändert': 'changed',
        'Changed': 'changed',
        'Behoben': 'fixed',
        'Fixed': 'fixed',
        'Entfernt': 'removed',
        'Removed': 'removed',
      }
      currentSection = { type: typeMap[sectionMatch[1]] || 'added', items: [] }
      current.sections.push(currentSection)
      continue
    }

    // Match list item: - **Something**: description
    const itemMatch = line.match(/^- (.+)/)
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1])
    }
  }

  if (current) versions.push(current)
  return versions
}

export async function GET() {
  // Always parse from CHANGELOG.md as source of truth
  const paths = ['/app/CHANGELOG.md', join(process.cwd(), 'CHANGELOG.md'), '/app/src/../CHANGELOG.md']

  for (const path of paths) {
    try {
      const md = readFileSync(path, 'utf-8')
      const versions = parseChangelog(md)

      if (versions.length > 0) {
        // Convert to the format the frontend expects
        const entries = versions.map((v, i) => ({
          id: i + 1,
          version: v.version,
          title: v.version === '0.1.0' ? 'Genesis' : v.version === '0.2.0' ? 'Synapse' : v.version === '0.3.0' ? 'Conductor' : `v${v.version}`,
          description: '',
          changes: v.sections.flatMap(s => s.items.map(item => ({ type: s.type, text: item }))),
          created_at: v.date,
        }))
        return NextResponse.json({ entries, markdown: md })
      }

      return NextResponse.json({ entries: [], markdown: md })
    } catch {}
  }

  return NextResponse.json({ entries: [], markdown: '# Changelog\n\nNoch keine Einträge.' })
}
