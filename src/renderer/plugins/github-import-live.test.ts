import { expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { verifyPluginPackage } from '@shared/plugins/verify'
import { downloadPluginPackage, resolvePluginPackageSource } from './package-source'
import { unpackPluginArchive } from './unpack'

const live = it.runIf(process.env.YACHIYO_LIVE_IMPORTS === '1')
const repo = 'https://github.com/kammmartin7-rgb/SLBG-PROJECT'
const revision = 'af449c3602647f7b7db1513296693a5bc7778641'

async function load(url: string) {
  const source = await resolvePluginPackageSource(url)
  const { bytes } = await downloadPluginPackage(source, 'audit')
  return { bytes, files: await unpackPluginArchive(bytes) }
}

live.each(['hello-yachiyo', 'ubuntu-runtime'])('verifies the pinned %s GitHub package', async id => {
  const path = 'plugin-marketplace/packages/' + id + '-1.0.0.zip'
  const { bytes, files } = await load(repo + '/blob/' + revision + '/' + path)
  expect(Buffer.from(bytes)).toEqual(await readFile(path))
  expect((await verifyPluginPackage({ packageBytes: bytes, files, source: 'sideload' })).manifest.id).toBe(id)
}, 90000)

live.each([repo, 'https://github.com/Wayne1145/yachiyo-claw'])('resolves a tool from %s', async url => {
  const { bytes, files } = await load(url)
  expect((await verifyPluginPackage({ packageBytes: bytes, files, source: 'sideload' })).manifest.id).toBe('ubuntu-runtime')
}, 90000)

live('rejects the incompatible jq release', async () => {
  const { bytes, files } = await load('https://github.com/jqlang/jq')
  await expect(verifyPluginPackage({ packageBytes: bytes, files, source: 'sideload' })).rejects.toThrow()
}, 90000)
