import { describe, expect, it, vi } from 'vitest'
import { resolvePluginPackageSource } from './package-source'

describe('plugin package source resolution', () => {
  it('resolves a GitHub repository to its release plugin asset', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            assets: [
              {
                name: 'yachiyo-plugin.zip',
                browser_download_url: 'https://github.com/acme/demo/releases/download/v1/yachiyo-plugin.zip',
                size: 1234,
                digest: `sha256:${'a'.repeat(64)}`,
              },
            ],
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch
    await expect(resolvePluginPackageSource('https://github.com/acme/demo', fetchImpl)).resolves.toEqual({
      url: 'https://github.com/acme/demo/releases/download/v1/yachiyo-plugin.zip',
      size: 1234,
      sha256: 'a'.repeat(64),
    })
  })

  it('rejects private URLs before making a request', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    await expect(resolvePluginPackageSource('https://127.0.0.1/plugin.zip', fetchImpl)).rejects.toThrow(
      'private_network_denied'
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('probes a direct HTTPS package URL for a bounded size', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 200, headers: { 'content-length': '2048' } })
    ) as unknown as typeof fetch
    await expect(resolvePluginPackageSource('https://downloads.example.com/demo.zip', fetchImpl)).resolves.toEqual({
      url: 'https://downloads.example.com/demo.zip',
      size: 2048,
    })
  })

  it('falls back to a one-byte range probe when HEAD has no size', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(
        new Response('x', { status: 206, headers: { 'content-range': 'bytes 0-0/4096' } })
      ) as unknown as typeof fetch
    await expect(
      resolvePluginPackageSource('https://downloads.example.com/demo.zip', fetchImpl)
    ).resolves.toMatchObject({ size: 4096 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rejects every redirect hop before following it to a private host', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://127.0.0.1/plugin.zip' },
        })
    ) as unknown as typeof fetch

    await expect(resolvePluginPackageSource('https://downloads.example.com/demo.zip', fetchImpl)).rejects.toThrow(
      'private_network_denied'
    )
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://downloads.example.com/demo.zip',
      expect.objectContaining({ method: 'HEAD', redirect: 'manual' })
    )
  })
})

it('resolves a GitHub ZIP file viewer link to package bytes', async () => {
  const raw = 'https://raw.githubusercontent.com/acme/demo/main/plugins/tool.zip'
  const fetchImpl = vi.fn(async () => new Response(null, { headers: { 'content-length': '100' } }))
  expect(await resolvePluginPackageSource('https://github.com/acme/demo/blob/main/plugins/tool.zip', fetchImpl))
    .toEqual({ url: raw, size: 100 })
  expect(fetchImpl).toHaveBeenCalledWith(raw, expect.objectContaining({ method: 'HEAD' }))
})

it('does not mistake a source release archive for an installable plugin', async () => {
  const fetchImpl = vi.fn(async (url) => String(url).includes('raw.githubusercontent.com') ? new Response(null, { status: 404 }) : Response.json({ assets: [
    { name: 'demo-source.zip', browser_download_url: 'https://example.com/demo-source.zip', size: 100 },
  ] }))
  await expect(resolvePluginPackageSource('https://github.com/acme/demo', fetchImpl))
    .rejects.toThrow('github_release_plugin_asset_missing')
})

it('uses a single packaged catalog tool when the release only contains the desktop application', async () => {
  const { default: catalog } = await import('../../../plugin-marketplace/index.json')
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(Response.json({ assets: [{ name: 'desktop.zip', size: 200_000_000 }] }))
    .mockResolvedValueOnce(Response.json(catalog))
  const entry = catalog.plugins[0]
  expect(await resolvePluginPackageSource('https://github.com/acme/demo', fetchImpl))
    .toEqual({ url: entry.packageUrl, size: entry.packageSize, sha256: entry.sha256 })
})
