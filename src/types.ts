export interface Machine<S, C> {
    states: StatesDefinition<S, C>;
    context?: C;
    initial: keyof S;
}

export type State<S, P, C> = {
    on: NormalState<S, P, C>
    entry?: (context: C | undefined) => void
    exit?: (context: C | undefined) => void
} | FinalState<C>

export type NormalState<S, P, C> = EventsPayload<S, P, C>

export type FinalState<C> = {
    final: true,
    entry?: (context: C | undefined) => void
    exit?: (context: C | undefined) => void
}

export interface Event<S, Payload, C> {
    execute?: (data: Payload, context: C | undefined) => void
    next_state: keyof S;
    guard?: (data: Payload, context: C | undefined) => boolean
    delay?: number
    preventCancel?: boolean
}

export type EventsPayload<S, P, C> = {
    [K in keyof P]: Event<S, P[K], C>
}

export type StatesDefinition<S, C> = {
    [K in keyof S]: State<S, S[K], C>
}

export type StateEventKeys<T> =  {
    [K in keyof T]: keyof T[K]
}

export type AllEvents<T> =
    StateEventKeys<T>[keyof StateEventKeys<T>]

export type PayloadByState<States, EventKey> = {
    [StateKey in keyof States]: EventKey extends keyof States[StateKey] ? States[StateKey][EventKey] : never
}

export type Listener<S> = (
    state: keyof S,
    previousState: keyof S
) => void

export type History<S> =
    | {
    from: keyof S
    to: keyof S
    event: AllEvents<S>
    timestamp: number
}
    | {
    from: keyof S
    to: keyof S
    action: "reset"
    timestamp: number
}

export type QueuedEvent<S> = {
    [K in AllEvents<S>]: {event: K, payload: PayloadByState<S, K>[keyof PayloadByState<S, K>]}
}[AllEvents<S>]

export type statusResult =
    | "transitioned"
    | "queued"
    | "scheduled"
    | "rejected"
    | "guard_blocked"

export interface SendResult {
    status: statusResult,
    reason?: "final_state" | "no_transition" | "invalid_state"
}
