/**
 * Finding a workspace's stack and naming it. No side effects, so it's tested
 * directly.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export interface Config {
  /** The product's domain label: stacks live under <stack>.<product>.localhost. */
  product: string;
  /** Prefix for the environment dekit.yaml reads: <ENV>_STACK, <ENV>_PORT_<SERVICE>, … */
  env: string;
  /** Where the router starts looking for a free port group. */
  near?: number;
  /** Service names; "main" is the stack's own host (<stack>.<product>.localhost). */
  services: string[];
  /** OAuth callback path → service, for the router's github.<product>.localhost relay. */
  relay?: Record<string, string>;
  /** The stack's state folder (local databases, stack.json), relative to the repo. */
  state?: string;
}

export interface Found {
  /** The repo holding localdev.json and dekit.yaml. */
  repo: string;
  config: Config;
}

function subdirs(dir: string): string[] {
  try {
    return readdirSync(dir).filter((d) => !d.startsWith('.') && statSync(join(dir, d)).isDirectory());
  } catch {
    return [];
  }
}

/**
 * From `start`, walk up to the nearest folder that has a localdev.json, or
 * whose child repo does. That works from anywhere in a workspace:
 * <workspace>/<repo>/… or the workspace itself.
 */
export function find(start: string): Found | null {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    for (const candidate of [dir, ...subdirs(dir).map((d) => join(dir, d))]) {
      const file = join(candidate, 'localdev.json');
      if (existsSync(file)) return { repo: candidate, config: JSON.parse(readFileSync(file, 'utf8')) as Config };
    }
    if (dirname(dir) === dir) return null;
  }
}

/** A DNS label: lowercase letters, digits and dashes, at most 63. */
export const label = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);

/**
 * The stack's name: its workspace folder and the agent folder above it
 * (/Volumes/Projects/kimi/this-fix/website → `this-fix-kimi`). A workspace
 * named after the product is just the agent (/Volumes/Projects/sami/cqx → `sami`).
 */
export function stackName(repo: string, product: string): string {
  const workspace = dirname(resolve(repo));
  const agent = label(basename(dirname(workspace)));
  const folder = label(basename(workspace));
  return folder === product ? agent : label(`${folder}-${agent}`);
}

/** The environment dekit.yaml reads, from the router's assignment. */
export function stackEnv(prefix: string, stack: string, state: string, services: Record<string, { port: number; url: string }>): Record<string, string> {
  const env: Record<string, string> = { [`${prefix}_STACK`]: stack, [`${prefix}_DEV_STATE`]: state };
  for (const [service, s] of Object.entries(services)) {
    const key = service.toUpperCase().replace(/-/g, '_');
    env[`${prefix}_PORT_${key}`] = String(s.port);
    env[`${prefix}_URL_${key}`] = s.url;
  }
  return env;
}
