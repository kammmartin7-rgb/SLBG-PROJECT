const { createServer } = require('node:http')
const { randomUUID } = require('node:crypto')
const { auth } = require('@modelcontextprotocol/sdk/client/auth.js')

function httpsUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw Error('OAuth requires HTTPS.')
  return url
}

function credentialKey(config) {
  return JSON.stringify([httpsUrl(config.url).href, config.oauth.clientId || '', [...(config.oauth.scopes || [])].sort(), config.oauth.resourceMetadataUrl || ''])
}

async function login(config, openBrowser, fetchImpl) {
  const resource = httpsUrl(config.url)
  const state = randomUUID()
  let resolveCode, rejectCode, verifier, tokens
  let registration = config.oauth.clientId ? { client_id: config.oauth.clientId } : undefined
  const code = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject })
  void code.catch(() => {})
  let redirect
  const listener = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (req.method !== 'GET' || req.headers.host !== redirect.host || url.pathname !== redirect.pathname || url.searchParams.get('state') !== state) {
      res.writeHead(400).end()
      return
    }
    const value = url.searchParams.get('code')
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('Return to Yachiyo Claw.')
    if (value) resolveCode(value)
    else rejectCode(Error('Authorization declined'))
  })
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve) })
  redirect = new URL('http://127.0.0.1:' + listener.address().port + '/callback')
  const timeout = setTimeout(() => rejectCode(Error('Sign-in timed out')), 180000)
  const provider = {
    redirectUrl: redirect,
    clientMetadata: { client_name: 'Yachiyo Claw', redirect_uris: [redirect.href], grant_types: ['authorization_code'], response_types: ['code'], token_endpoint_auth_method: 'none' },
    state: () => state,
    clientInformation: () => registration,
    saveClientInformation: value => { registration = value },
    tokens: () => tokens,
    saveTokens: value => { tokens = value },
    saveCodeVerifier: value => { verifier = value },
    codeVerifier: () => verifier,
    redirectToAuthorization: url => openBrowser(httpsUrl(url).href),
  }
  const options = {
    serverUrl: resource, scope: config.oauth.scopes?.join(' '),
    resourceMetadataUrl: config.oauth.resourceMetadataUrl ? httpsUrl(config.oauth.resourceMetadataUrl) : undefined,
    fetchFn: (input, init) => fetchImpl(httpsUrl(input instanceof Request ? input.url : input), {
      ...init, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000)
    }),
  }
  try {
    const status = await auth(provider, options)
    if (status === 'REDIRECT') await auth(provider, { ...options, authorizationCode: await code })
    if (!tokens?.access_token || tokens.token_type.toLowerCase() !== 'bearer') throw Error('No bearer token issued')
    return { value: tokens.access_token, expires: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined }
  } finally {
    clearTimeout(timeout)
    listener.close()
    listener.closeAllConnections()
  }
}
module.exports = { credentialKey, login, httpsUrl }
