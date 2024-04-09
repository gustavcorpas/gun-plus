import { GunUser, ISEAPair } from "gun";
import { app_scoped } from "../../functions/utils";
import GunPlus, { GunNodeClassSimple } from "../../gun";
import { StateMachineEvent, auth_state_machine, events, states, use_machine } from "./state-machine";
import { make_certificate, policies } from "./cert";
import GunNode from "../gun-node";

/** A valid user alias. Must be checked with the as_alias function. */
type GunAlias = string & { _value: never }
/** A valid user password. Must be checked with the AuthManager.validate function. */
type GunPassword = string & { _value: never };


/** An auth manager that wraps gun.user logic. */
export default class AuthManager {

    static INITIAL_STATE = states.disconnected;
    static state = use_machine(auth_state_machine, AuthManager.INITIAL_STATE);
    static instance: AuthManager;

    gunplus: GunPlus;

    /** Returns the validated alias and password information. This will also be scoped using app_scope from GunPlus */
    async validate(alias: string, password: string) {
        if(password.length < 8) throw new Error("Passwords in gun must be more than 8 characters long!");
        if(alias.length < 1) throw new Error("User name must be more than 0 characters long!");

        const app_scope = this.gunplus.app_scope;
        const validated_alias = app_scoped(alias, app_scope) as GunAlias;
        const validated_password = app_scoped(password, app_scope) as GunPassword;
        
        return {alias: validated_alias, password: validated_password}
    }

    /** A new AuthManager. */
    constructor(gunplus: GunPlus) {
        if(AuthManager.instance) {
            this.gunplus = AuthManager.instance.gunplus;
            return AuthManager.instance
        }
        this.gunplus = gunplus;
        AuthManager.instance = this;
    }

    /** Gets the user chain, if authenticated. */
    get chain() {
        return this.gunplus.soul(this.pair({strict: true}).pub).chain;
    }

    /** 
     * Attempt to get the pair of the currently logged in user. 
     * 
     * You may do `pair({strict})` to throw if the user is not authenticated.
     * */
    pair(options: {strict: true}): ISEAPair;
    pair(options?: {strict?: false}): ISEAPair | undefined;
    pair(options: {strict?: boolean} = {}) {
        const user = this.gunplus.gun.user()._;
        if("sea" in user){
            return user.sea as ISEAPair
        }
        if(options.strict){
            throw new Error("Failed to get user pair! User is not authenticated");
        }
        return undefined;
    }

     /**
     * Generate a new gun user pair using alias and password.
     * 
     * @param alias - The user alias.
     * @param password - The user password.
     * @returns A promise that resolves with gun ack or rejects with gun ack on errors.
     */
    create = async ({alias, password}: {alias: GunAlias, password: GunPassword}): Promise<{ok: 0, pub: string}|{err: string}> => {

        // Note: throws if state transitions is not possible.
        AuthManager.state.set(new StateMachineEvent(events.create));

        // attempt to create user.
        try {
            const res = await
                new Promise<{ok: 0, pub: string}>((resolve, reject) => {
                    this.gunplus.gun
                    this.gunplus.gun.user().create(alias, password, (ack) => {
                        if ("err" in ack) {
                            reject(ack);
                            return;
                        }
                        resolve(ack);
                    });
                });
            
            // creation success.
            AuthManager.state.set(new StateMachineEvent(events.success));
            return res;
        } catch (err) {
            // creation failure.
            AuthManager.state.set(new StateMachineEvent(events.fail, err));
            throw err;
        }
    }

    /**
     * Authenicate existing gun user using either a pair or a alias/password combination.
     * @returns A promise that resolves with gun ack or rejects with gun ack on errors.
     */
    auth = async (info: {alias: GunAlias, password: GunPassword} | ISEAPair): Promise<GunAuthAck> => {

        AuthManager.state.set(new StateMachineEvent(events.authenticate));
        // attempt to authenticate user.
        try{
            const res = await
                new Promise<GunAuthAck>((resolve, reject) => {
                    if("pub" in info){
                        this.gunplus.gun.user().auth({pub: info.pub, priv: info.priv, epub: info.epub, epriv: info.epriv}, (ack) => { // TODO: Use ...spread operator. tsconfig options?
                            if("err" in ack) {
                                reject(new Error(ack.err));
                                return;
                            }
                            else resolve(ack);                             
                        })
                    }else{
                        this.gunplus.gun.user().auth(info.alias, info.password, (ack) => {
                            if("err" in ack) {
                                reject(new Error(ack.err));
                                return;
                            }
                            else resolve(ack); 
                        });
                    }
                });
            // on auth success
            AuthManager.state.set(new StateMachineEvent(events.success));
            return res;
            
        } catch(err) {
            // on auth error
            AuthManager.state.set(new StateMachineEvent(events.fail));
            throw err;
        }
    }


     /**
     * Un-authenticates the currently authenticated gun user.
     */
    leave = async () => {
        // check if state transition is possible.
        AuthManager.state.set(new StateMachineEvent(events.disconnect));
        
        // attempt log out.
        try{
            const res = await
                new Promise<{success: true}>((resolve, reject) => {
                    this.gunplus.gun.user().leave();
                    if(this.pair()?.pub) {
                        reject({err: "User leave failed!"});
                        return;
                    }
                    resolve({success: true});
                });
            
            // on success.
            AuthManager.state.set(new StateMachineEvent(events.success));
            return res;

        }catch(err){
            // on fail.
            AuthManager.state.set(new StateMachineEvent(events.fail));
            throw err;
        }
        
    }

    /** 
     * A simple default certificate that will allow everybody to write to the users graph, as long as the key or path contains their public key. 
     * 
     * For more advanced things, use the make_certificate or SEA.certify function directly.
     * */
    certify() {
        return make_certificate([{pub: "*"}], [ policies.contains_pub ] )
    }

}



export type GunAuthAck = {
    ack: 2;
    soul: string;
    get: string;
    put: GunUser;
    sea: ISEAPair;
}|{
    err: string
}