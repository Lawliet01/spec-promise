// import { CompletionRecord } from "./base.js"

import {
    HostEnqueuePromiseJob
} from "./alternative.js"

import {
    NewPromiseReactionJob,
    NewPromiseResolveThenableJob
} from "./jobs.js"

// 27.2.1.1 PromiseCapability Records
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promisecapability-records
class PromiseCapbilityRecord {
    constructor(promise, resolve, reject) {
        this.Promise = promise
        this.Resolve = resolve
        this.Reject = reject
    }
}

// 27.2.1.2 PromiseReaction Records
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promisereaction-records
class PromiseReactionRecord {
    constructor(capability, type, handler){
        this.Capability = capability
        this.Type = type
        this.Handler = handler
    }
}

// 27.2.1.1.1 IfAbruptRejectPromise
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-ifabruptrejectpromise
// function IfAbruptRejectPromise(value, capability){
//     if (value.type !== 'normal') {
//         capability.reject.call(undefined, value.value)
//         return capability.promise
//     } else {
//         value = value.value
//     }
// }

// 27.2.1.3 CreateResolvingFunctions
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-createresolvingfunctions
function createResolvingFunction(promise){
    let alreadyResolve = {value : false}

    /** 这里的赋值形式是这样的：
     * {
     *  resolve: (0, () => {}),
     *  reject: (0, () => {})
     * }
     * 使用箭头函数是为了创建非constructor的函数
     * 使用(0, fn)是为了使得function.name为"" 
     * 标准内使用createBuildIn()实现上面两点
     * 你完全可以忽略这个形式，这里仅仅为了通过两个测试：
     *      create-resolving-functions-reject.js
     *      create-resolving-functions-resolve.js
    **/
    return {
        // 27.2.1.3.2 Promise Resolve Functions
        // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise-resolve-functions
        resolve:(0, (resolution) => {
            if (alreadyResolve.value) return undefined
            alreadyResolve.value = true

            if (resolution === promise) {
                let selfResolutionError = new TypeError()
                RejectPromise(promise, selfResolutionError)
                return undefined
            } else if (!(resolution instanceof Object)) {
                FulFillPromise(promise, resolution)
                return undefined
            } 
            
            let then 
            try {
                then = resolution.then
            } catch(e){
                RejectPromise(promise, e)
                return undefined
            }

            let thenAction = then
            if (typeof thenAction !== 'function'){
                FulFillPromise(promise, resolution)
                return undefined
            }

            let thenJobCallback = thenAction
            let job = NewPromiseResolveThenableJob(promise, resolution, thenJobCallback)
            HostEnqueuePromiseJob(job)
        }),

        // 27.2.1.3.1 Promise Reject Functions
        // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise-reject-functions
        reject: (0, (reason) => {
            if (alreadyResolve.value) return undefined
            alreadyResolve.value = true
            RejectPromise(promise, reason)
            return undefined
        })
    }
}

// 27.2.1.4 FulfillPromise ( promise, value )
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-fulfillpromise
function FulFillPromise(promise, value){
    console.assert(promise.__PromiseState === "pending")
    let reactions = promise.__PromiseFulfillReactions
    promise.__PromiseResult = value
    promise.__PromiseFulfillReactions = undefined
    promise.__PromiseRejectReactions = undefined
    promise.__PromiseState = "fulfilled"
    TriggerPromiseReactions(reactions, value)
}

// 27.2.1.5 NewPromiseCapability
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-newpromisecapability
function NewPromiseCapability(C){
    let resolvingFunctions = {
        Resolve: undefined,
        Reject: undefined
    }

    let executor = (0, (resolve, reject) => {
        if (resolvingFunctions.Resolve !== undefined) throw new TypeError
        if (resolvingFunctions.Reject !== undefined) throw new TypeError
        resolvingFunctions.Resolve = resolve
        resolvingFunctions.Reject = reject
    })

    let promise = new C(executor)
    if (typeof resolvingFunctions.Resolve !== 'function') throw new TypeError
    if (typeof resolvingFunctions.Reject !== 'function') throw new TypeError

    return new PromiseCapbilityRecord(promise, resolvingFunctions.Resolve, resolvingFunctions.Reject)
}

// 27.2.1.6 IsPromise ( x )
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-ispromise
function IsPromise(x){
    if (!(x instanceof Object)) return false
    if (!Object.getOwnPropertyNames(x).includes('__PromiseState')) return false
    return true
}

// 27.2.1.7 RejectPromise ( promise, reason )
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-rejectpromise
function RejectPromise(promise, reason){
    console.assert(promise.__PromiseState === "pending")
    let reactions = promise.__PromiseRejectReactions
    if (!reactions) debugger
    promise.__PromiseResult = reason
    promise.__PromiseFulfillReactions = undefined
    promise.__PromiseRejectReactions = undefined
    promise.__PromiseState = "rejected"
    if (!promise.promiseIsHandled) HostPromiseRejectionTracker(promise, "reject")
    TriggerPromiseReactions(reactions, reason)
}

// 27.2.1.8 TriggerPromiseReactions
function TriggerPromiseReactions(reactions,argument) {
    if (!reactions) debugger
    for (let reaction of reactions) {
        let job = NewPromiseReactionJob(reaction, argument)
        HostEnqueuePromiseJob(job)
    }
}


// 27.2.1.9 HostPromiseRejectionTracker ( promise, operation )
// https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-host-promise-rejection-tracker
function HostPromiseRejectionTracker(promise, operation){
    // 浏览器宿主：追溯到 HTML-spec 8.1.6.3
    // https://html.spec.whatwg.org/#the-hostpromiserejectiontracker-implementation
    return null
}



export {
    PromiseReactionRecord,
    PromiseCapbilityRecord,
    NewPromiseCapability,
    IsPromise,
    HostPromiseRejectionTracker,
    createResolvingFunction
}