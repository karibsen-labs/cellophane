# Cellophane

**Predictable state machines, wrapped in TypeScript.**

Define states and transitions once. Cellophane types your events and payloads and stops invalid transitions before they run.

```bash
pnpm add @karibsen-labs/cellophane
```

## Why Cellophane?

- **Type-safe**: event names and payloads are inferred from your state definitions
- **Guarded**: transitions only run when their guard passes
- **Predictable**: events sent during a transition are queued and run in order
- **Timed**: delayed transitions are built in and cancel themselves when the state changes
- **Traceable**: every transition is recorded in `history`
- **Tiny**: no dependencies

## Quick Start

### 1. Define your machine

```ts
import { defineCellophane } from "@karibsen-labs/cellophane";

const machine = defineCellophane({
    initial: "idle",
    context: { count: 0 },

    states: {
        idle: {
            on: {
                start: {
                    next_state: "running",
                    guard: (data: string) => data.length > 0,
                    execute: (data, ctx) => ctx && ctx.count++,
                },
            },
        },
        running: {
            entry: () => console.log("started"),
            on: {
                stop: { next_state: "done", delay: 1000 }, // runs after 1s
            },
        },
        done: {
            final: true,
        },
    },
});
```

### 2. Subscribe to changes

```ts
const unsubscribe = machine.subscribe((state, previous) => {
    console.log(`${String(previous)} -> ${String(state)}`);
});
```

### 3. Send events

```ts
machine.can("start");        // true
machine.send("start", "go"); // { status: "transitioned" }
machine.send("stop");        // { status: "scheduled" }
machine.state;               // "running", then "done" after 1s
```

## Transitions

| Option | Description |
| --- | --- |
| `next_state` | State to move to. |
| `guard(payload, ctx)` | Returns `false` to block the transition. |
| `execute(payload, ctx)` | Runs after the target state's `entry`. |
| `delay` | Milliseconds to wait before transitioning. |
| `preventCancel` | Keeps a delayed transition alive when the state changes. |

States can also declare `entry(ctx)` and `exit(ctx)` hooks. Use `final: true` for terminal states.

## API

| Method / property | Description |
| --- | --- |
| `send(event, payload)` | Runs a transition and returns a `SendResult`. |
| `can(event, payload?, { bypassGuard? })` | Checks whether a transition is possible. |
| `subscribe(listener)` | Listens for state changes. Returns an unsubscribe function. |
| `reset({ context? })` | Returns to the initial state, optionally clearing the context. |
| `clearContext()` | Sets the context to `undefined`. |
| `state` / `context` | Current state and context. |
| `history` | Copy of past transitions (`from`, `to`, `event` or `action`, `timestamp`). |
| `info.initial` / `info.previous` | Initial and previous state. |

### `SendResult`

| `status` | Meaning |
| --- | --- |
| `transitioned` | The state changed. |
| `queued` | Sent during a transition; it runs once the current one finishes. |
| `scheduled` | The transition has a `delay` and will run later. |
| `guard_blocked` | The guard returned `false`. |
| `rejected` | Includes a `reason`: `no_transition`, `final_state` or `invalid_state`. |

## How It Works

```
send(event) → guard → exit → next state → entry → execute → listeners → next queued event
```

## License

MIT, by `@karibsen-labs`
