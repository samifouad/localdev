# localdev

One command to run a workspace's local stack: every service of a
multi-repo app, on port-less preview URLs, next to anyone else's stacks on
the same machine.

```sh
localdev            # start this workspace's stack (opens dekit's live view in a terminal)
localdev down       # stop it and release its name and ports
localdev restart    # stop, then start
localdev attach     # bring the live view back
localdev ls         # every stack on this machine
```

No flags. Run it anywhere inside the workspace.

## Requires

localdev is the front end; two tools do the work, and **both are required**:

- **[dekit](https://dekit.run)** runs the stack's services (`dekit.yaml`).
  Install it with `curl -fsSL https://dekit.run/install.sh | sh`.
- **[dekit-router](https://github.com/samifouad/dekit-router)** assigns each
  stack a port group and serves it on `http://<service>.<stack>.<product>.localhost`
  with no port. Build it and run `dekit-router setup` once.

## How it works

1. From where you are, localdev walks up to the workspace, a folder holding
   the stack's repos side by side, and finds the repo with a `localdev.json`.
2. It names the stack after the workspace folder and the agent folder above
   it: `/Volumes/Projects/kimi/this-fix` becomes `this-fix-kimi`. A workspace
   named after the product is just the agent, so `/Volumes/Projects/sami/cqx`
   becomes `sami`.
3. It registers the stack with dekit-router, which assigns free ports and
   returns the URLs, and writes them to `<state>/stack.json`.
4. It starts a fresh dekit runner for that repo's `dekit.yaml` with the
   stack's environment:

   | variable | value |
   |---|---|
   | `<ENV>_STACK` | the stack name |
   | `<ENV>_DEV_STATE` | the state folder (local databases, stack.json) |
   | `<ENV>_PORT_<SERVICE>` | the port the router assigned |
   | `<ENV>_URL_<SERVICE>` | e.g. `http://id.sami.cqx.localhost` |
5. In a terminal it opens dekit's live view. An agent with no terminal just
   gets the stack started.

`localdev down` stops the runner, and every process it started, then releases
the name and ports.

## localdev.json

One per stack, in the repo that holds its `dekit.yaml`:

```json
{
  "product": "cqx",
  "env": "CQX",
  "near": 3000,
  "services": ["main", "id", "dashboard"],
  "relay": { "/connect/callback": "main", "/auth/github/callback": "id" },
  "state": "../.cqx-dev"
}
```

- `main` is the stack's own host (`sami.cqx.localhost`). Every other service
  is `<service>.sami.cqx.localhost`.
- `relay` sends OAuth callbacks from dekit-router's single
  `github.<product>.localhost` address to the right stack. See
  dekit-router's README.

## Install

```sh
bun run install:local    # a single binary into ~/.local/bin/localdev
```

## License

Apache-2.0
