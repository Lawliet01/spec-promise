import { PromiseCapbilityRecord, createResolvingFunction } from "./obstract_operations.js"

// 27.2.2.1 NewPromiseReactionJob ( reaction, argument )
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-newpromisereactionjob
function NewPromiseReactionJob(reaction, argument){
    let job = function(){
        let {Capability:promiseCapability, Type, Handler} = reaction
        let handlerResult
        let isAbruptCompletion = false

        try {
            if (!Handler) {
                if (Type === "Fulfill") {
                    handlerResult = argument
                } else {
                    console.assert(Type === "Reject")
                    throw argument
                }
            } else {
                handlerResult = Handler.call(undefined, argument)
            }
        } catch(e) {
            isAbruptCompletion = true
            handlerResult = e
        }

        if (promiseCapability === undefined) return null
        console.assert(promiseCapability instanceof PromiseCapbilityRecord)

        if (isAbruptCompletion){
            return promiseCapability.Reject.call(undefined, handlerResult)
        } else {
            return promiseCapability.Resolve.call(undefined, handlerResult)
        }
    }
    // 关于Realm的逻辑忽略

    return job
}

// 27.2.2.2 NewPromiseResolveThenableJob ( promiseToResolve, thenable, then )
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-newpromiseresolvethenablejob
function NewPromiseResolveThenableJob( promiseToResolve, thenable, then ){
    let job = function(){
        let resolvingFunction = createResolvingFunction(promiseToResolve)
        try {
            let thenCallResult = then.call(thenable, resolvingFunction.resolve, resolvingFunction.reject)
            return thenCallResult
        } catch (e) {
            resolvingFunction.reject.call(undefined, e)
        }
    }

    // 关于Realm的逻辑忽略
    return job
}

export {
    NewPromiseReactionJob,
    NewPromiseResolveThenableJob
}