# Freelance Flow

A freelancer's project board where every milestone you complete is stamped on BOT Chain. Share one link so clients can verify your progress.

*No tokens, no payments, no escrow, no admin. Project titles and client names are public, so use a studio name or initials.*

## Status

| | |
|---|---|
| Live site | https://freelanceflow.online/ |
| Contract (BOT Chain mainnet, chain ID 677) | [`0xcf3b9ce7959aD5926438978CAC1447655e0d8C17`](https://scan.botchain.ai/address/0xcf3b9ce7959aD5926438978CAC1447655e0d8C17) |
| Contract (testnet, chain ID 968) | _not deployed yet_ |

## Project layout

- `index.html` — the whole frontend (ethers.js v6 from CDN, no build step, no backend)
- `contracts/FreelanceFlow.sol` — the contract (Solidity ^0.8.20)
- `deploy.html` — one-click deploy from MetaMask
- `build/` — compiled ABI and bytecode, plus the standard JSON input for explorer verification
- `tools/` — scripts that compile the contract, test it, and run a throwaway local chain
- `images/bot-chain.png` — the BOT Chain logo used in the footer

## Run locally

```bash
python3 -m http.server 4579
```

Then open http://localhost:4579. Until a contract address is configured the site runs in *preview mode*: projects are saved in this browser's localStorage, so every screen can be reviewed before deploying. Without MetaMask, preview mode signs you in with a demo address.

## 1. Deploy the contract

Compiled with Solidity 0.8.20, optimizer 200 runs, EVM `paris`.

1. Run the site locally and open http://localhost:4579/deploy.html in a browser with MetaMask.
2. Click **Deploy to Testnet (968)**, confirm in MetaMask, then try the app at http://localhost:4579/?net=testnet. On localhost the app picks up the address you just deployed.
3. Click **Deploy to Mainnet (677)**.
4. Paste each address into the matching `contract: ''` field in `CONFIG.networks` at the top of the script in `index.html`, and into the Status table above. The footer, the app and the client pages all read the mainnet address from that one constant.

Or use Remix: paste `contracts/FreelanceFlow.sol` into https://remix.ethereum.org, compile with 0.8.20 and EVM version `paris`, deploy with *Injected Provider – MetaMask*.

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| Testnet | 968 | https://rpc.bohr.life | https://scan.bohr.life |
| Mainnet | 677 | https://rpc.botchain.ai | https://scan.botchain.ai |

To verify the source on the explorer, use "Standard JSON input" with `build/FreelanceFlow.standard-input.json` and compiler `v0.8.20+commit.a1b79de6`.

## 2. Publish the site

GitHub Pages serves the `gh-pages` branch, so publish with `git push origin main:gh-pages` after pushing `main` (or switch the Pages source to `main` under Settings → Pages). For a custom domain, add it under Settings → Pages, which creates the `CNAME` file, then update the live URL in the Status table.

## How it works

- **Home page** — the site opens on a landing page with an animated sample project; *Launch app* goes to the board at `#/projects`.
- **Create** — `createProject(title, client, titles, dueDates)` stores a project with 1–10 milestones and emits `ProjectCreated`. Titles are capped at 80 bytes and the client name at 60.
- **Complete** — `completeMilestone(projectId, index)` can only be called by the wallet that created the project, and only once per milestone. The completion time is the block timestamp, so it can't be backdated.
- **Share** — *Copy client link* gives `?project=N`, a read-only page loaded straight from the contract over the public RPC. No wallet needed. Project ids start at 0.
- **Overdue** is a display rule only: a milestone is overdue once its due day has ended and it is still open. Due dates are whole days stored as UTC midnight, so the freelancer and the client see the same calendar date.
- **Transaction links** — the contract stores completion times, not transaction hashes. The site finds each hash from the `MilestoneCompleted` events and remembers it in localStorage. If the lookup fails, the "Verified" badge links to the contract instead.
- Add `?net=testnet` to use the testnet contract. Client links keep the parameter.

## Tests

```bash
npm --prefix tools install
node tools/compile.mjs && node tools/test-contract.mjs   # contract, on an in-memory chain
```

To click through the on-chain flow without spending gas, start a local chain with the contract deployed and open the URL it prints (localhost only):

```bash
node tools/local-chain.mjs
```

That needs a wallet pointed at `http://127.0.0.1:8545` (chain ID 1337), for example MetaMask with one of the local chain's test accounts.
