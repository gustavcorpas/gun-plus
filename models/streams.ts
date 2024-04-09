import type { IGunChain, IGunOnEvent } from "gun";
import GunNode from "./gun-node";
import type { GunNodeClass, GunNodeClassSimple } from "../gun";

export type ValidGunChunk = {
    key: string,
    value: any,
    chain: IGunChain<any>
}

export type NullGunChunk = {
    key: string,
    value: null,
    chain: null
}

export type ValidGunNodeChunk<T extends GunNode> = {
    key: string,
    value: any,
    node: T
}

export type NullGunNodeChunk = {
    key: string,
    value: any,
    node: null
}

declare global {
    interface ReadableStream<R> {
        [Symbol.asyncIterator](): AsyncIterableIterator<R>;
    }
}

/**
 * 
 * Only Firefox implements async iterable on ReadableStream. This will add polyfill.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream#browser_compatibility
 */
(function enable_async_iterator_polyfill() {
    ReadableStream.prototype[Symbol.asyncIterator] = async function* (this: ReadableStream) {
        const reader = this.getReader()
        try {
          while (true) {
            const {done, value} = await reader.read()
            if (done) return
            yield value
          }
        }
        finally {
          reader.releaseLock()
        }
      }
})();


/**
 * 
 * Wraps .on call in a stream. Cancelling the stream will unsubscribe from updates from gun.
 * 
 * **Usage:**
 * ```
 * const stream = on_stream(node)
 * for await (const chunk of stream) {
 *    // Do something with each 'chunk'
 * }
 * ```
 */
export function on_stream(chain: IGunChain<any>) {
    
    let ev: IGunOnEvent;
    const stream = new ReadableStream<ValidGunChunk | NullGunChunk>({
        start(controller) {
            console.log("stream started");
            chain.on(function(this: IGunChain<any>, value, key, _, event) {
                ev = event;
                console.log(`from stream, ${key}`);
                controller.enqueue({value, key, chain: this});
            })
        },
        cancel() {
            console.log("stream cancelled");
            if(!ev) {
                // TODO log
                return;
            }
            ev.off();
        }
    });

    return stream;
}

/**
 * 
 * Takes an incoming stream, but only issues updates if the data changes from valid data to null data.
 * You can use this to keep a list in sync with the gun state. If data is tombstoned, it can be removed from the list.
 * 
 * **Example:**
 * ```
 * const map = new Map();
 * const items = [];
 * const stream = on_stream(node).pipeThrough(unique_transformer());
 * for await (const chunk of stream) {
 *      chunk.value === null ? map.delete(chunk.key) : map.set(chunk.key, chunk.chain);
        items.splice(0, items.length, ...map.values());
 * }
 * ```
 */
export function to_unique() {
    const map = new Map<string, IGunChain<any> | null>();

    const transformer = new TransformStream<ValidGunChunk | NullGunChunk, ValidGunChunk | NullGunChunk>({
        transform(chuck, controller) {

            if(!map.has(chuck.key)){
                pass(controller, chuck);
                return;
            }

            const old_value = map.get(chuck.key);

            if(chuck.value === null && old_value !== null) {
                pass(controller, chuck);
                return;
            }

            if(chuck.value !== null && old_value === null) {
                pass(controller, chuck);
                return;
            }
            
            function pass(controller: TransformStreamDefaultController<any>, chuck: ValidGunChunk | NullGunChunk){
                map.set(chuck.key, chuck.chain);
                controller.enqueue(chuck);
            }
            
        }
    })

    return transformer;
}


/**
 * Transoforms a stream of gun chains into a stream of gun nodes.
 */
export function to_node<T extends GunNode = GunNode>(target: GunNodeClassSimple<T>) {
    const transformer = new TransformStream<ValidGunChunk | NullGunChunk, ValidGunNodeChunk<T> | NullGunNodeChunk>({
        transform(chunk, controller) {
            const new_chunk = chunk.chain ? 
                    {value: chunk.value, key: chunk.key, node: new target(chunk.chain)} : 
                    {value: chunk.value, key: chunk.key, node: chunk.chain}
            controller.enqueue(new_chunk);
        }
    })
    return transformer;
}
