const { FetchRequest, JsonRpcProvider } = require('./vendor/ethers/ethers.umd.min.js')
async function metisBlock() {
  const request = new FetchRequest('https://andromeda.metis.io/?owner=1088')
  request.timeout = 8000
  const provider = new JsonRpcProvider(request, undefined, { batchMaxCount: 1 })
  try {
    const chain = await provider.send('eth_chainId', [])
    if (BigInt(chain) !== 1088n) throw Error('Unexpected Metis chain ID')
    const block = await provider.send('eth_blockNumber', [])
    return { chainId: 1088, block: BigInt(block).toString() }
  } finally { provider.destroy() }
}
module.exports = { metisBlock }
