import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { find, label, stackEnv, stackName } from '../src/workspace.ts';

const root = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'localdev-'));
function workspace(agent: string, folder: string, repos: string[], home: string) {
  const ws = join(root, agent, folder);
  for (const r of repos) mkdirSync(join(ws, r, 'lib'), { recursive: true });
  writeFileSync(join(ws, home, 'localdev.json'), JSON.stringify({ product: 'cqx', env: 'CQX', services: ['main', 'id'] }));
  return ws;
}

test('names a stack after its workspace and agent', () => {
  expect(stackName('/Volumes/Projects/kimi/this-fix/website', 'cqx')).toBe('this-fix-kimi');
  expect(stackName('/Volumes/Projects/sami/cqx/website', 'cqx')).toBe('sami');
  expect(stackName('/x/Codex Agent/Fix_Login!/website', 'cqx')).toBe('fix-login-codex-agent');
});

test('labels are DNS-safe', () => {
  expect(label('A b_C..d--')).toBe('a-b-c-d');
  expect(label('x'.repeat(80)).length).toBe(63);
});

test('finds the stack from anywhere in the workspace', () => {
  const ws = workspace('kimi', 'this-fix', ['id', 'website', 'mobileapp'], 'website');
  for (const start of [ws, join(ws, 'id'), join(ws, 'id', 'lib'), join(ws, 'website'), join(ws, 'mobileapp', 'lib')]) {
    expect(find(start)?.repo).toBe(join(ws, 'website'));
  }
});

test('nothing to find outside a workspace', () => {
  const lonely = join(root, 'nobody', 'empty');
  mkdirSync(lonely, { recursive: true });
  expect(find(lonely)).toBeNull();
});

test('the environment dekit.yaml reads', () => {
  expect(stackEnv('CQX', 'sami', '/w/.cqx-dev', {
    main: { port: 3000, url: 'http://sami.cqx.localhost' },
    'my-svc': { port: 3001, url: 'http://my-svc.sami.cqx.localhost' },
  })).toEqual({
    CQX_STACK: 'sami', CQX_DEV_STATE: '/w/.cqx-dev',
    CQX_PORT_MAIN: '3000', CQX_URL_MAIN: 'http://sami.cqx.localhost',
    CQX_PORT_MY_SVC: '3001', CQX_URL_MY_SVC: 'http://my-svc.sami.cqx.localhost',
  });
});
