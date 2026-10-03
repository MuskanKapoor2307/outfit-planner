import { NextRequest, NextResponse } from 'next/server'

/**
 * Content Security Policy with a fresh nonce per request.
 * The browser may only run scripts from this app, and may only talk to:
 *  - your Supabase project (data, photos, login)
 *  - staticimgly.com (the free background-removal model, downloaded once)
 *  - Google Fonts (theme fonts)
 *  - the three AI providers, called straight from the browser with the
 *    person's own key (the key never touches our server)
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  let supabaseHost = ''
  try {
    supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host
  } catch {}
  const sbHttp = supabaseHost ? `https://${supabaseHost}` : ''
  const sbWs = supabaseHost ? `wss://${supabaseHost}` : ''

  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' blob:${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' blob: data: ${sbHttp};
    connect-src 'self' ${sbHttp} ${sbWs} https://staticimgly.com https://generativelanguage.googleapis.com https://api.anthropic.com https://api.openai.com blob: data:;
    worker-src 'self' blob:;
    manifest-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${isDev ? '' : 'upgrade-insecure-requests;'}
  `.replace(/\s{2,}/g, ' ').trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
