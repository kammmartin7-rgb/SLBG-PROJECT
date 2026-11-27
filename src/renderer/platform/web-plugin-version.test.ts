import { expect, it, vi } from 'vitest'
import { version } from '../../../package.json'
import WebPlatform from './web_platform'

vi.mock('@/platform', () => ({ default: { type: 'web' } }))

it('advertises the product version for plugin minimum-version checks', async () => {
  expect(await WebPlatform.prototype.getVersion()).toBe(version)
})
