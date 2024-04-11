import type { GunValueSimple, IGunChain, IGunOnEvent } from "gun";
import GunPlus, { type GunNodeClass, type GunNodeClassSimple } from "../gun";
import { on_stream, to_node, to_unique } from "./streams";

type DynamicClass<T> = T extends GunNode ? GunNode extends T ? GunNode<T> : T : never

/**
 * A GunNode wrapping normal gun chain.
 */
export default class GunNode<T extends GunNode<any> = GunNode<any>> {

    /**
     * Using .map on the GunNode will correctly map to specified node in type argument.
     * 
     * **Usage**
     * ```js
     *  const a = new GunNode<UserNode>(GunPlus.instance.node, {iterates: UserNode});
     *  const b = new GunNode(GunPlus.instance.node, {});
     *
     *  a.map().hello; // hello from UserNode.
     *  b.map().hello // not availble on normal GunNode so will not work.
     * ``` 
     */
    constructor(
        public chain: IGunChain<any>,
        private options: {certificate?: string, iterates?: GunNodeClassSimple<T> } = {}
    ){
    }

    get certificate() {
        return this.options.certificate;
    }

    set certificate(certificate) {
        this.options.certificate = certificate;
    }

    private get iterates() {
        return this.options.iterates ?? GunNode<T>
    }

    // READING AND PUTTING SIMPLE VALUES

    /**
     * Put a value at this node. Will use certificate if available.
     */
    put(value: GunValueSimple | IGunChain<any>) {
        const options = this.certificate ? {opt: {cert: this.certificate} } : undefined;
        return this.chain.put(value, undefined, options);
    }

    /**
     * Wrapper around gun.get. If iterates is specified, this will be used here. Carries options.
     */
    get(key: string) {
        return new this.iterates(this.chain.get(key), this.options) as DynamicClass<T>
    }

    /**
     * Use to add something to an array-like structure.
     * 
     * This will very simply do `chain.get(key).put(value)` where key is generated using `GunPlus.instance.id_generator` if not specified.
     */
    add(value: GunValueSimple | IGunChain<any>, key?: string) {
        const id = key || GunPlus.instance.id_generator();
        this.chain.get(id).put(value);
    }


    /**
     * **Example:**
     * 
     * ```
     * const unsubscribe = node.watch("").subscribe(({value, key, chain}) => {
     *      console.log({value, key, chain});
     * })
     * ```
     */
    watch<T2>(initial: T2) {

        const subscribe = (cb: (response: {value: T2 | null, key: string, chain: null | IGunChain<any>}) => any) => {
            const stream = on_stream(this.chain);
            cb({value: initial, key: "", chain: null});

            (async () => {
                for await (const chunk of stream) {
                    cb(chunk)
                 }
            })();

            return () => { // return unsubscriber
                stream.cancel();
            } 
        }
        
        return {subscribe}
    }

    /**
     * Two way data-binding for gun.
     * This will return only value in the subscribe callback.
     * If you need more advanced functionality you need to use a combination of `node.watch` and `node.put`.
     * 
     * @example
     * const store = node.bind("");
     * store.set("hello");
     * store.subscribe(value => console.log(value));
     */
    bind<T2 extends GunValueSimple>(intial: T2) {
        const store = this.watch(intial);
        let value: T2 | null = intial;

        const subscribe = (cb: (new_value: T2 | null) => any) => {
            const unsubscriber = store.subscribe(response => {
                value = response.value;
                cb(response.value);
            });

            return unsubscriber
        }

        const set = (new_value: T2) => {
            value = new_value;
            this.put(value);
        }

        const update = (cb: (new_value: T2 | null) => T2) => {
            value = cb(value);
            this.put(value);
        }

        return {subscribe, set, update}
    }


    // ITERATION LOGIC

    /**
     * Wrapps guns map and iterates GunNodes of the correc type.
     */
    map() {
        return new this.iterates(this.chain.map(), this.options) as DynamicClass<T>
    }

    /**
     * Get a readable stream for the data at this code.
     * Data is updated if it becomes null.
     * 
     * **Usage:**
     * ```js
     * for await (const chunk of node.stream()) {
     *      chunk.value === null ? map.delete(chunk.key) : map.set(chunk.key, chunk.chain);
     *      items.splice(0, items.length, ...map.values());
     * }
     * ```
     */
    stream() {
        const stream = on_stream(this.map().chain)
            .pipeThrough(to_unique())
            .pipeThrough(to_node<T>(this.iterates as GunNodeClassSimple<T>));
        return stream;
    }

}
