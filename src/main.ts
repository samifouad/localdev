#!/usr/bin/env bun
/**
 * localdev: run this workspace's local stack. Requires dekit (the process
 * runner, https://dekit.run) and dekit-router (the port-less preview router,
 * https://github.com/samifouad/dekit-router).
 *
 *   localdev            start it (and open dekit's live view in a terminal)
 *   localdev down       stop it and release its name and ports
 *   localdev restart    stop, then start
 *   localdev attach     bring the live view back
 *   localdev ls         every stack on this machine
 *
 * Run it anywhere inside a workspace: <folder>/<repo>/…, where one repo
 * describes the stack in `localdev.json` next to its `dekit.yaml`:
 *
 *   { "product": "cqx", "env": "CQX", "near": 3000,
 *     "services": ["main", "id", "dashboard"],
 *     "relay": { "/connect/callback": "main", "/auth/github/callback": "id" },
 *     "state": "../.cqx-dev" }
 *
 * The stack is named after the workspace folder and the agent folder above it
 * (/Volumes/Projects/kimi/this-fix → `this-fix-kimi`; a workspace named after
 * the product is just the agent). The router assigns the ports; dekit gets
 * <ENV>_STACK, <ENV>_DEV_STATE, <ENV>_PORT_<SERVICE> and <ENV>_URL_<SERVICE>.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { find, stackEnv, stackName } from './workspace.ts';

const VERSION = '0.1.0';

function fail(message: string): never {
  console.error(`localdev: ${message}`);
  process.exit(1);
}

function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; quiet?: boolean } = {}) {
  const r = spawnSync(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, encoding: 'utf8', stdio: opts.quiet ? 'pipe' : 'inherit' });
  return r;
}

function need(cmd: string, hint: string) {
  if (spawnSync('which', [cmd]).status !== 0) fail(`${cmd} is not on PATH (${hint})`);
}

const [command = 'up', ...extra] = process.argv.slice(2);
if (extra.length) fail(`unexpected ${extra.join(' ')}`);
if (command === 'version' || command === '--version') { console.log(`localdev ${VERSION}`); process.exit(0); }
if (command === 'help' || command === '--help' || command === '-h') {
  console.log(readme());
  process.exit(0);
}
need('dekit', 'https://dekit.run');
need('dekit-router', 'github.com/samifouad/dekit-router');

if (command === 'ls') process.exit(run('dekit-router', ['ls']).status ?? 1);

const found = find(process.cwd());
if (!found) fail('no localdev.json in this workspace (run it inside a folder holding the stack\'s repos)');
const { repo, config } = found;
const name = stackName(repo, config.product);
const state = resolve(repo, config.state ?? `../.${config.product}-dev`);
const dekit = (args: string[], env?: NodeJS.ProcessEnv) => run('dekit', ['-C', repo, ...args], { env });

function down() {
  run('dekit', ['-C', repo, 'runner', 'stop'], { quiet: true });
  run('dekit-router', ['release', config.product, name], { quiet: true });
  console.log(`localdev: ${config.product}/${name} stopped`);
}

function up() {
  const relay = Object.entries(config.relay ?? {}).flatMap(([path, service]) => ['--relay', `${path}=${service}`]);
  const registered = run('dekit-router', [
    'register', config.product, name,
    '--services', config.services.join(','),
    '--near', String(config.near ?? 3000),
    ...relay,
  ], { quiet: true });
  if (registered.status !== 0) fail(registered.stderr.trim() || 'dekit-router register failed');
  const stack = JSON.parse(registered.stdout);
  mkdirSync(state, { recursive: true });
  writeFileSync(join(state, 'stack.json'), `${JSON.stringify(stack, null, 2)}\n`);

  const env: NodeJS.ProcessEnv = { ...process.env, ...stackEnv(config.env, name, state, stack.services) };
  console.log(`localdev: ${config.product} stack "${name}"`);
  for (const [service, s] of Object.entries(stack.services) as [string, { url: string }][]) console.log(`  ${service.padEnd(10)} ${s.url}`);
  // The runner keeps the environment it started with: start a fresh one.
  run('dekit', ['-C', repo, 'runner', 'stop'], { quiet: true });
  const code = dekit(['up'], env).status ?? 1;
  if (code !== 0) process.exit(code);
  // The happy path for a person: watch it. An agent (no terminal) just gets it started.
  if (process.stdout.isTTY && process.stdin.isTTY) dekit(['attach']);
}

switch (command) {
  case 'up': up(); break;
  case 'down': down(); break;
  case 'restart': down(); up(); break;
  case 'attach': process.exit(dekit(['attach']).status ?? 1);
  default: fail(`unknown command "${command}" (try: localdev, localdev down, localdev restart, localdev attach, localdev ls)`);
}

function readme() {
  return `localdev ${VERSION}: run this workspace's local stack behind dekit-router

  localdev            start it (and open dekit's live view in a terminal)
  localdev down       stop it and release its name and ports
  localdev restart    stop, then start
  localdev attach     bring the live view back
  localdev ls         every stack on this machine

Run it anywhere inside a workspace; the stack is described by a repo's localdev.json.`;
}
