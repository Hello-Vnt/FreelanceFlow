// Starts a throwaway local chain with the contract deployed, for trying the on-chain flow offline.
// Usage (from the project root): node tools/compile.mjs && node tools/local-chain.mjs
// Then serve the site and open the printed URL. Stop with Ctrl+C; nothing is kept.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory } from 'ethers';

const PORT = 8545;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { abi, bytecode } = JSON.parse(readFileSync(join(root, 'build/FreelanceFlow.json'), 'utf8'));

const server = ganache.server({ logging: { quiet: true }, chain: { hardfork: 'merge', chainId: 1337 } });
await server.listen(PORT);

const signer = await new BrowserProvider(server.provider).getSigner(0);
const contract = await (await new ContractFactory(abi, bytecode, signer).deploy()).waitForDeployment();

console.log(`local chain on http://127.0.0.1:${PORT} (chain ID 1337)`);
console.log(`contract ${await contract.getAddress()}`);
console.log(`open http://localhost:4579/?net=local&contract=${await contract.getAddress()}`);
