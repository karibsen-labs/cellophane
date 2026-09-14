import {
    AllEvents,
    Listener,
    Machine,
    PayloadByState,
    History,
    QueuedEvent,
    SendResult,
} from "./types.js";

export function defineCellophane<S, C>(p: Machine<S, C>) {


    const initialState = p.initial;
    let previousState: keyof S | undefined;
    let currentState = p.initial;

    let isTransitioning: boolean = false;

    let context: C | undefined = p.context;

    const listeners = new Set<Listener<S>>();
    const history: History<S>[] = [];
    const delays = new Map<AllEvents<S>, {
        timer: ReturnType<typeof setTimeout>,
        state: keyof S,
        preventCancel?: boolean
    }>();

    const eventQueue: QueuedEvent<S>[] = [];

    const send = <K extends AllEvents<S>>(
        event: K,
        payload: PayloadByState<S, K>[keyof PayloadByState<S, K>]
    ): SendResult => {

        if (isTransitioning) {
            eventQueue.push({event: event, payload: payload});
            return {status: "queued"};
        }

        const cState = p.states[currentState];

        if (!cState) {
            return {
                status: "rejected",
                reason: "invalid_state"
            };
        }

        if (!('on' in cState)) {
            return {
                status: "rejected",
                reason: "final_state"
            };
        }

        const transition = cState.on[event];

        if (!transition) {
            return {
                status: "rejected",
                reason: "no_transition"
            };
        }

        if (transition.delay) {

            if (delays.has(event)) {
                let delay = delays.get(event);
                clearTimeout(delay?.timer)
            }

            let timeout = setTimeout(() => {
                processTransition(event, payload)
                delays.delete(event);
            }, transition.delay)

            delays.set(event, {timer: timeout, state: currentState, preventCancel: transition.preventCancel ?? false})
            return {status: "scheduled"}
        }

        return processTransition(event, payload)
    }

    const processTransition = <K extends AllEvents<S>>(event: K, payload: PayloadByState<S, K>[keyof PayloadByState<S, K>]): SendResult => {

        let cState = p.states[currentState];

        if (!cState) {
            return {
                status: "rejected",
                reason: "invalid_state"
            };
        }

        if (!('on' in cState)) {
            return {
                status: "rejected",
                reason: "final_state"
            };
        }

        const transition = cState.on[event];

        if (!transition) {
            return {
                status: "rejected",
                reason: "no_transition"
            };
        }

        if (transition.guard && !transition.guard(payload, context)) return {status: "guard_blocked"};

        isTransitioning = true;

        try {
            cState.exit?.(context);

            cancelDelays();

            previousState = currentState;

            currentState = transition.next_state;


            history.push({
                from: previousState,
                to: currentState,
                event: event,
                timestamp: Date.now()
            });

            cState = p.states[currentState];

            cState.entry?.(context);

            transition.execute?.(payload, context);

            listeners.forEach((listener) => {
                listener(currentState, previousState!)
            });
        } finally {
            isTransitioning = false
        }

        const nextEvent = eventQueue.shift()
        if (nextEvent) {
            send(nextEvent.event, nextEvent.payload);
        }

        return {status: "transitioned"};

    }

    const can = <K extends AllEvents<S>>(
        event: K,
        payload?: PayloadByState<S, K>[keyof PayloadByState<S, K>],
        options: { bypassGuard?: boolean } = {}
    ): boolean => {
        const cState = p.states[currentState];

        if (!cState || !('on' in cState)) return false;

        const transition = cState.on[event];
        if (!transition) return false;

        if (payload !== undefined && !options.bypassGuard) {
            if (transition.guard) {
                return transition.guard(payload, context);
            }
        }

        return true;
    }

    const subscribe = (listener: Listener<S>) => {
        listeners.add(listener);

        return () => listeners.delete(listener);
    }

    const reset = (options: { context?: boolean } = {}) => {
        if (options.context) clearContext();
        cancelDelays();
        if (currentState === initialState) return;

        const cState = p.states[currentState];

        cState.exit?.(context);

        previousState = currentState;
        currentState = initialState;

        history.push({
            from: previousState,
            to: currentState,
            action: "reset",
            timestamp: Date.now()
        });

        const initial = p.states[currentState];

        initial.entry?.(context);

        listeners.forEach((listener) => {
            listener(currentState, previousState!)
        });
    }

    const clearContext = () => {
        context = undefined;
    }

    const cancelDelays = () => {
        delays.forEach((delay, delayedEvent) => {
            if (delay.state === currentState && delay.preventCancel === false) {
                clearTimeout(delay.timer);
                delays.delete(delayedEvent);
            }
        })
    }

    return {
        info: {
            initial: initialState,
            get previous() {
                return previousState;
            }
        },
        get state() {
            return currentState;
        },
        get context() {
            return context;
        },
        get history() {
            return [...history]
        },
        send,
        reset,
        can,
        subscribe,
        clearContext,
    }
}