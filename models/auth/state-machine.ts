

/** Transistion function that takes a state and event and outputs a new state */
interface Machine {
    (state: AUTH_STATE, event: StateMachineEvent): AUTH_STATE
}

/** A state machine event with optional data */
export class StateMachineEvent{
    type: AUTH_EVENT;
    data: any;
    
    constructor(type: AUTH_EVENT, data: any = {}){
        this.type = type;
        this.data = data;
    }
}

/**
 * 
 * @param machine - A machine function that defines state transitions.
 * @param initial - The initial state of the machine.
 */
export function use_machine(machine: Machine, initial: AUTH_STATE) {
    
    let state = initial;
    let subs = new Map<string, (state: AUTH_STATE) => any>();

    function subscribe(cb: (state: AUTH_STATE) => any) {
        const id = crypto.randomUUID();
        subs.set(id, cb);
        cb(state);

        return () => {
            subs.delete(id);
        }
    }

    function set(event: StateMachineEvent): void {
        state = machine(state, event);
        for(const sub of subs.values()){
            sub(state);
        }
    }


    return {
        /** 
         * Subscribe to state updates.
         * @returns an unsubscriber */
        subscribe, 
        /** attempt to update the state machine */
        set
    }
}



/** Possible states that the auth-manager can be in. */
export const states = {
    /** The user is in an un-busy and unauthorized state.*/
    disconnected: "disconnected" as const,
    /** A user is currently being created. */
    creating: "creating" as const,
    /** A user is currently being authorized. */
    pending: "pending" as const,
    /** The user is in an un-busy and authorized state. */
    authorized: "authorized" as const,
    /** The user is currently logging out. */
    leaving: "leaving" as const,
}


/** Possible events that the auth-manager can take. */
export const events = {
    create: "create" as const,
    authenticate: "authenticate" as const,
    disconnect: "disconnect" as const,
    fail: "fail" as const,
    success: "success" as const,
}

export type AUTH_EVENT = keyof typeof events
export type AUTH_STATE = keyof typeof states

class StateTransitionError extends Error {
    constructor(message: string, public state: AUTH_STATE, public event: AUTH_EVENT){
        super(message);   
    }
}

/**
 * Defines possible transitions from the states in the auth manager.
 * 
 * @param state - The current state.
 * @param event The event that has happend.
 * @returns The new state.
 */
export function auth_state_machine(state: AUTH_STATE, event: StateMachineEvent): AUTH_STATE{
    const transition_error = new StateTransitionError("Not a valid state transition", state, event.type);

    switch (state) {
        // User is disconnected and unbusy
        case states.disconnected:
            if(event.type === events.create){
                return states.creating
            }
            if(event.type === events.authenticate){
                return states.pending
            }
            throw transition_error
        // User is creating and busy
        case states.creating:
            if(event.type === events.fail){
                return states.disconnected;
            }
            if(event.type === events.success){
                return states.disconnected;
            }
            throw transition_error;
        // User is logging in and busy
        case states.pending:
            if(event.type === events.fail){
                return states.disconnected;
            }
            if(event.type === events.success){
                return states.authorized;
            }
            throw transition_error;
        // User is authorized and unbusy
        case states.authorized:
            if(event.type === events.disconnect){
                return states.leaving;
            }
            throw transition_error;
        // User is leaving and busy
        case states.leaving:
            if(event.type === events.fail){
                return states.authorized;
            }
            if(event.type === events.success){
                return states.disconnected;
            }
            throw transition_error;
        default:
            throw transition_error;
    }
}