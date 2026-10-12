// Runs the compiled contract on an in-memory chain and checks create → complete → read.
// Usage (from the project root): node tools/compile.mjs && node tools/test-contract.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory } from 'ethers';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { abi, bytecode } = JSON.parse(readFileSync(join(root, 'build/FreelanceFlow.json'), 'utf8'));

const provider = new BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'merge' } }));
const [alice, bob] = await Promise.all([provider.getSigner(0), provider.getSigner(1)]);

const contract = await (await new ContractFactory(abi, bytecode, alice).deploy()).waitForDeployment();
const event = (receipt, name) => receipt.logs.map((l) => contract.interface.parseLog(l)).find((l) => l?.name === name);
const blockTime = async (receipt) => BigInt((await provider.getBlock(receipt.blockNumber)).timestamp);

const titles = ['Moodboard', 'Logo concepts', 'Final files'];
const dues = [1791000000n, 1792000000n, 1793000000n];

// create
const created = await (await contract.createProject('Brand identity', 'Studio Nara', titles, dues)).wait();
const createdEvent = event(created, 'ProjectCreated');
assert.equal(createdEvent.args.id, 0n);
assert.equal(createdEvent.args.owner, alice.address);
assert.equal(createdEvent.args.title, 'Brand identity');
console.log(`createProject (3 milestones) gas: ${created.gasUsed}`);

await (await contract.connect(bob).createProject('Landing page', 'K.L.', ['Wireframe'], [1791000000n])).wait();
await (await contract.createProject('Pitch deck', 'Acme', ['Outline', 'Slides'], [1791000000n, 1792000000n])).wait();

let [project, milestones] = await contract.getProject(0);
assert.equal(project.owner, alice.address);
assert.deepEqual([project.title, project.client, project.total, project.done], ['Brand identity', 'Studio Nara', 3n, 0n]);
assert.equal(project.createdAt, await blockTime(created));
assert.deepEqual(milestones.map((m) => [m.title, m.dueDate, m.completedAt]), titles.map((t, i) => [t, dues[i], 0n]));

assert.deepEqual([...(await contract.projectsOf(alice.address))], [0n, 2n]);
assert.deepEqual([...(await contract.projectsOf(bob.address))], [1n]);
assert.equal(await contract.totalProjects(), 3n);

// complete: stamped with the block timestamp, in any order
const completed = await (await contract.completeMilestone(0, 1)).wait();
const completedEvent = event(completed, 'MilestoneCompleted');
assert.deepEqual([completedEvent.args.projectId, completedEvent.args.index], [0n, 1n]);
assert.equal(completedEvent.args.completedAt, await blockTime(completed));
console.log(`completeMilestone gas: ${completed.gasUsed}`);

[project, milestones] = await contract.getProject(0);
assert.equal(project.done, 1n);
assert.deepEqual(milestones.map((m) => m.completedAt), [0n, completedEvent.args.completedAt, 0n]);

const found = await contract.queryFilter(contract.filters.MilestoneCompleted(0));
assert.deepEqual(found.map((l) => [l.args.index, l.transactionHash]), [[1n, completed.hash]]);

await (await contract.completeMilestone(0, 0)).wait();
await (await contract.completeMilestone(0, 2)).wait();
assert.equal((await contract.getProject(0))[0].done, 3n);

const reverts = async (call, name) => {
  await assert.rejects(call, (e) => e.revert?.name === name, `expected ${name}`);
};
const long = (n) => 'x'.repeat(n);

// completeMilestone guards
await reverts(contract.completeMilestone.staticCall(0, 1), 'AlreadyCompleted');
await reverts(contract.connect(bob).completeMilestone.staticCall(2, 0), 'NotOwner');
await reverts(contract.completeMilestone.staticCall(2, 2), 'MilestoneNotFound');
await reverts(contract.completeMilestone.staticCall(3, 0), 'ProjectNotFound');
await reverts(contract.getProject(3), 'ProjectNotFound');

// createProject guards
const create = (...args) => contract.createProject.staticCall(...args);
await reverts(create('T', 'C', [], []), 'InvalidMilestones');
await reverts(create('T', 'C', Array(11).fill('m'), Array(11).fill(1n)), 'InvalidMilestones');
await reverts(create('T', 'C', ['a', 'b'], [1n]), 'InvalidMilestones');
await reverts(create('', 'C', ['a'], [1n]), 'InvalidTitle');
await reverts(create(long(81), 'C', ['a'], [1n]), 'InvalidTitle');
await reverts(create('T', '', ['a'], [1n]), 'InvalidClient');
await reverts(create('T', long(61), ['a'], [1n]), 'InvalidClient');
await reverts(create('T', 'C', [''], [1n]), 'InvalidTitle');
await reverts(create('T', 'C', [long(81)], [1n]), 'InvalidTitle');
await reverts(create('T', 'C', ['a'], [0n]), 'InvalidDueDate');

// limits are accepted
const max = await (await contract.createProject(long(80), long(60), Array(10).fill(long(80)), Array(10).fill(1n))).wait();
console.log(`createProject (10 max-length milestones) gas: ${max.gasUsed}`);
assert.equal((await contract.getProject(3))[1].length, 10);

console.log('contract tests passed');
