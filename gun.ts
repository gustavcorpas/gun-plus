import type { GunOptions, IGun, IGunChain, IGunInstance, ISEA, ISEAPair } from "gun";
import GunNode from "./models/gun-node";
import AuthManager from "./models/auth/auth";

/**
 * Configuration object for the GunPlusClass
 */
type GunPlusConfiguration = {
    /** Default id generator. Used by e.g. `GunPlus.instance.new` function. */
    id_generator: () => string
}

type GunImports = {
    Gun: IGun,
    SEA: ISEA
}

/** Enhances the functionality and usability of GunDB */
export default class GunPlus {

    static instance: GunPlus;

    /** This will import gun at run time to avoid any server side-effects. */
    static async imports() {
        const Gun = (await import("gun/gun")).default;
        const SEA = (await import("gun/sea")).default;

        return {Gun, SEA} as GunImports;
    }
    
    static state = AuthManager.state

    Gun: IGun;
    SEA: ISEA;
    gun: IGunInstance<any>;
    node: GunNode;
    app_scope: string;

    id_generator: GunPlusConfiguration["id_generator"];

    /** Get info about the user */
    get user() {return AuthManager.instance}
    

    /**
     * __Example Usage__:
     * 
     * instantiate
     * ```js
     * class EntryNode extends GunNode {...}
     * new GunPlus<EntryNode>("some-app-scope", EntryNode, {peers});
     * ```
     * use
     * ```js
     * GunPlus.instance.node.some.key.put("value");
     * ```
     */
    constructor(
        /** Main Gun components, loaded from GunPlus.import_gun */
        imports: GunImports,
        /** Will place everything on an app scope under gun.get(app_scope) */
        app_scope: string, 
        /** Gun options that will be passed on when instantiaing. */
        options: GunOptions,
        /** Configuration for the GunPlus class */
        configuration?: GunPlusConfiguration
    ) {
        if(GunPlus.instance) {
            this.Gun = GunPlus.instance.Gun;
            this.SEA = GunPlus.instance.SEA;
            this.gun = GunPlus.instance.gun;
            this.node = GunPlus.instance.node;
            this.id_generator = configuration?.id_generator || (() => crypto.randomUUID());
            this.app_scope = app_scope;

            return GunPlus.instance;
        }
        
        this.Gun = imports.Gun;
        this.SEA = imports.SEA;
        this.gun = this.Gun(options);
        if(app_scope.length > 0){
            this.node = new GunNode(this.gun.get(app_scope));
        }else {
            this.node = new GunNode(this.gun as unknown as IGunChain<any>);
        }
        this.id_generator = configuration?.id_generator || (() => crypto.randomUUID());
        this.app_scope = app_scope;

        new AuthManager(this); // initialize the singleton.

        GunPlus.instance = this;
    }

    /** Return the app-scoped node wrapped in the class that is passed in to the function. */
    wrap<T extends GunNode>(node: GunNodeClassSimple<T>) {
        return new node(this.node.chain);
    }

    /** Returns the write protected space of a public key, 
     * and wraps it in the specified node or standard GunNode if not specifed. 
     * 
     * **Example usage:**
     * ```js
     * const user = GunPlus.instance.soul("asd", UserNode);
     * const group_stream = user.groups.stream();
     * ```
     * */
    soul<T extends GunNode>(pub: string, node?: GunNodeClassSimple<T>) {
        const node_class = node ? node : GunNode as GunNodeClassSimple<T>
        return new node_class(this.gun.get(`~${pub}`));
    }

    /**
     * 
     * Creates a new node with an id in `gun.get("your-app-scope").get("nodes")`
     */
    new<T extends GunNode>(node?: GunNodeClassSimple<T>, id?: string) {
        const node_class = node ? node : GunNode as GunNodeClassSimple<T>
        const the_id = id ? id : this.id_generator();
        return new node_class(this.node.get("nodes").get(the_id).chain);
    }


}

export type GunNodeClassSimple<T> = new (chain: IGunChain<any>) => T
export type GunNodeClass<T> = new (chain: IGunChain<any>, options?: {certificate?: string, iterates?: GunNodeClass<T> } ) => T