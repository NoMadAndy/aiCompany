import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// App-Container laufen im gleichen Docker-Netzwerk (aicompany_aicompany).
// Wir erreichen sie direkt ueber ihren Container-Namen auf Port 80 (intern).
// Fallback: ueber host.docker.internal auf den Host-Port.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return new NextResponse('Missing slug', { status: 400 })
  }

  try {
    const res = await query(
      `SELECT id, code, name, language, deploy_type, container_status, port
       FROM deployed_apps WHERE url_slug = $1 AND status = $2`,
      [slug, 'active']
    )

    if (res.rows.length === 0) {
      return new NextResponse('App not found', { status: 404 })
    }

    const app = res.rows[0]

    // Docker-deployed App: Proxy zum Container ueber Docker-Netzwerk
    if (app.deploy_type === 'docker' && app.container_status === 'running' && app.port) {
      try {
        // Container-Name im Netzwerk: aicompany-app-{id}, intern auf Port 80
        const containerName = `aicompany-app-${app.id}`
        const containerUrl = `http://${containerName}:80${getProxyPath(request)}`
        const proxyRes = await fetch(containerUrl, {
          headers: { 'Accept': 'text/html,*/*' },
          signal: AbortSignal.timeout(10000),
        })

        const body = await proxyRes.arrayBuffer()
        const headers = new Headers()
        // Content-Type vom Container uebernehmen
        const contentType = proxyRes.headers.get('content-type')
        if (contentType) headers.set('Content-Type', contentType)
        headers.set('X-App-Name', app.name)
        headers.set('X-Deploy-Type', 'docker')
        headers.set('X-App-Port', String(app.port))

        return new NextResponse(body, { status: proxyRes.status, headers })
      } catch (proxyErr: any) {
        // Fallback: Container nicht erreichbar → zeige Fehlermeldung
        return new NextResponse(containerErrorPage(app.name, app.port, proxyErr.message), {
          status: 502,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
    }

    // Inline-App: HTML direkt aus DB
    return new NextResponse(app.code, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-App-Name': app.name,
        'X-Deploy-Type': 'inline',
      },
    })
  } catch (error: any) {
    return new NextResponse(`Error: ${error.message}`, { status: 500 })
  }
}

/** Extrahiert den Sub-Pfad nach dem slug-Parameter fuer den Proxy */
function getProxyPath(request: Request): string {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  return path ? `/${path}` : '/'
}

/** Fehlerseite wenn Container nicht erreichbar ist */
function containerErrorPage(name: string, port: number, error: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} - Nicht erreichbar</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f1117;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
.card{background:#1a1b26;border:1px solid #2d2d3d;border-radius:1rem;padding:2.5rem;max-width:480px;text-align:center}
h1{color:#f87171;font-size:1.5rem;margin-bottom:0.75rem}
p{color:#94a3b8;font-size:0.875rem;line-height:1.6;margin-bottom:1rem}
.port{font-family:monospace;color:#818cf8;background:#818cf820;padding:0.125rem 0.5rem;border-radius:0.25rem}
.error{font-family:monospace;font-size:0.75rem;color:#64748b;background:#0f1117;padding:0.75rem;border-radius:0.5rem;margin-top:1rem;word-break:break-all}
</style>
</head>
<body>
<div class="card">
<h1>Container nicht erreichbar</h1>
<p><strong>${name}</strong> auf Port <span class="port">${port}</span> antwortet nicht.</p>
<p>Der Container startet moeglicherweise noch oder ist gestoppt. Pruefe den Status auf der Apps-Seite.</p>
<div class="error">${error}</div>
</div>
</body>
</html>`
}
