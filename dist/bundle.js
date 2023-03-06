(function () {
    'use strict';

    function HostEnqueuePromiseJob(job){
        return queueMicrotask(job)
    }

    // 27.2.2.1 NewPromiseReactionJob ( reaction, argument )
    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-newpromisereactionjob
    function NewPromiseReactionJob(reaction, argument){
        let job = function(){
            let {Capability:promiseCapability, Type, Handler} = reaction;
            let handlerResult;
            let isAbruptCompletion = false;

            try {
                if (!Handler) {
                    if (Type === "Fulfill") {
                        handlerResult = argument;
                    } else {
                        console.assert(Type === "Reject");
                        throw argument
                    }
                } else {
                    handlerResult = Handler.call(undefined, argument);
                }
            } catch(e) {
                isAbruptCompletion = true;
                handlerResult = e;
            }

            if (promiseCapability === undefined) return null
            console.assert(promiseCapability instanceof PromiseCapbilityRecord);

            if (isAbruptCompletion){
                return promiseCapability.Reject.call(undefined, handlerResult)
            } else {
                return promiseCapability.Resolve.call(undefined, handlerResult)
            }
        };
        // 关于Realm的逻辑忽略

        return job
    }

    // 27.2.2.2 NewPromiseResolveThenableJob ( promiseToResolve, thenable, then )
    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-newpromiseresolvethenablejob
    function NewPromiseResolveThenableJob( promiseToResolve, thenable, then ){
        let job = function(){
            let resolvingFunction = createResolvingFunction(promiseToResolve);
            try {
                let thenCallResult = then.call(thenable, resolvingFunction.resolve, resolvingFunction.reject);
                return thenCallResult
            } catch (e) {
                resolvingFunction.reject.call(undefined, e);
            }
        };

        // 关于Realm的逻辑忽略
        return job
    }

    // import { CompletionRecord } from "./base.js"

    // 27.2.1.1 PromiseCapability Records
    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promisecapability-records
    class PromiseCapbilityRecord {
        constructor(promise, resolve, reject) {
            this.Promise = promise;
            this.Resolve = resolve;
            this.Reject = reject;
        }
    }

    // 27.2.1.2 PromiseReaction Records
    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promisereaction-records
    class PromiseReactionRecord {
        constructor(capability, type, handler){
            this.Capability = capability;
            this.Type = type;
            this.Handler = handler;
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
        let alreadyResolve = {value : false};

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
                alreadyResolve.value = true;

                if (resolution === promise) {
                    let selfResolutionError = new TypeError();
                    RejectPromise(promise, selfResolutionError);
                    return undefined
                } else if (!(resolution instanceof Object)) {
                    FulFillPromise(promise, resolution);
                    return undefined
                } 
                
                let then; 
                try {
                    then = resolution.then;
                } catch(e){
                    RejectPromise(promise, e);
                    return undefined
                }

                let thenAction = then;
                if (typeof thenAction !== 'function'){
                    FulFillPromise(promise, resolution);
                    return undefined
                }

                let thenJobCallback = thenAction;
                let job = NewPromiseResolveThenableJob(promise, resolution, thenJobCallback);
                HostEnqueuePromiseJob(job);
            }),

            // 27.2.1.3.1 Promise Reject Functions
            // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise-reject-functions
            reject: (0, (reason) => {
                if (alreadyResolve.value) return undefined
                alreadyResolve.value = true;
                RejectPromise(promise, reason);
                return undefined
            })
        }
    }

    // 27.2.1.4 FulfillPromise ( promise, value )
    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-fulfillpromise
    function FulFillPromise(promise, value){
        console.assert(promise.PromiseState === "pending");
        let reactions = promise.PromiseFulfillReactions;
        promise.PromiseResult = value;
        promise.PromiseFulfillReactions = undefined;
        promise.PromiseRejectReactions = undefined;
        promise.PromiseState = "fulfilled";
        TriggerPromiseReactions(reactions, value);
    }

    // 27.2.1.5 NewPromiseCapability
    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-newpromisecapability
    function NewPromiseCapability(C){
        let resolvingFunctions = {
            Resolve: undefined,
            Reject: undefined
        };

        let executor = (0, (resolve, reject) => {
            if (resolvingFunctions.Resolve !== undefined) throw new TypeError
            if (resolvingFunctions.Reject !== undefined) throw new TypeError
            resolvingFunctions.Resolve = resolve;
            resolvingFunctions.Reject = reject;
        });

        let promise = new C(executor);
        if (typeof resolvingFunctions.Resolve !== 'function') throw new TypeError
        if (typeof resolvingFunctions.Reject !== 'function') throw new TypeError

        return new PromiseCapbilityRecord(promise, resolvingFunctions.Resolve, resolvingFunctions.Reject)
    }

    // 27.2.1.6 IsPromise ( x )
    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-ispromise
    function IsPromise(x){
        if (!(x instanceof Object)) return false
        if (!Object.getOwnPropertyNames(x).includes('PromiseState')) return false
        return true
    }

    // 27.2.1.7 RejectPromise ( promise, reason )
    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-rejectpromise
    function RejectPromise(promise, reason){
        console.assert(promise.PromiseState === "pending");
        let reactions = promise.PromiseRejectReactions;
        if (!reactions) debugger
        promise.PromiseResult = reason;
        promise.PromiseFulfillReactions = undefined;
        promise.PromiseRejectReactions = undefined;
        promise.PromiseState = "rejected";
        if (!promise.promiseIsHandled) HostPromiseRejectionTracker(promise, "reject");
        TriggerPromiseReactions(reactions, reason);
    }

    // 27.2.1.8 TriggerPromiseReactions
    function TriggerPromiseReactions(reactions,argument) {
        if (!reactions) debugger
        for (let reaction of reactions) {
            let job = NewPromiseReactionJob(reaction, argument);
            HostEnqueuePromiseJob(job);
        }
    }


    // 27.2.1.9 HostPromiseRejectionTracker ( promise, operation )
    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-host-promise-rejection-tracker
    function HostPromiseRejectionTracker(promise, operation){
        // 浏览器宿主：追溯到 HTML-spec 8.1.6.3
        // https://html.spec.whatwg.org/#the-hostpromiserejectiontracker-implementation
        return null
    }

    let Promise$1 = class Promise {
        constructor(executor){
            if (!new.target) throw new TypeError("Promise constructor cannot be invoked without 'new'")
            if (typeof executor !== 'function') throw new TypeError("Promise resolver  is not a function")
            
            this.PromiseState = "pending";
            this.PromiseFulfillReactions = [];
            this.PromiseRejectReactions = [];
            this.PromiseIsHandled = false;

            let resolvingFunction = createResolvingFunction(this);
            try {
                executor.call(undefined, resolvingFunction.resolve, resolvingFunction.reject);
            } catch (e) {
                resolvingFunction.reject.call(undefined, e);
            }

            return this
        }

        then(onFulfilled, onRejected){
            // 27.2.5.4.1 PerformPromiseThen
            // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromisethen
            const PerformPromiseThen = (promise, onFulfilled, onRejected, resultCapability) => {
                console.assert(IsPromise(promise));
                if (!resultCapability) resultCapability = undefined;
            
                let onFulfilledJobCallback = typeof onFulfilled === 'function' ? onFulfilled : null;
                let onRejectedJobCallback = typeof onRejected === 'function' ? onRejected : null;
            
                let fulfilledReaction = new PromiseReactionRecord(resultCapability,"Fulfill",onFulfilledJobCallback);
                let rejectReaction = new PromiseReactionRecord(resultCapability, "Reject", onRejectedJobCallback);
            
                if (promise.PromiseState === "pending"){
                    promise.PromiseFulfillReactions.push(fulfilledReaction);
                    promise.PromiseRejectReactions.push(rejectReaction);
                } else if (promise.PromiseState === "fulfilled") {
                    let value = promise.PromiseResult;
                    let fulfillJob = NewPromiseReactionJob(fulfilledReaction, value);
                    HostEnqueuePromiseJob(fulfillJob);
                } else {
                    console.assert(promise.PromiseState === "rejected");
                    let reason = promise.PromiseResult;
                    HostPromiseRejectionTracker(promise, "handler");
                    let rejectJob = NewPromiseReactionJob(rejectReaction, reason);
                    HostEnqueuePromiseJob(rejectJob);
                }
                promise.PromiseIsHandled = true;
            
                if (resultCapability === undefined) return undefined
                return resultCapability.Promise
            };

            let promise = this;
            if (!IsPromise(promise)) throw new TypeError

            let C = promise.constructor;
            let S = C[Symbol.species];
            if ((S instanceof Object) && S.prototype) C = S;

            let resultCapability = NewPromiseCapability(C);
            return PerformPromiseThen(promise, onFulfilled, onRejected, resultCapability)
        }
        catch(onRejected){
            return this.then(undefined, onRejected)
        }
        finally(onFinally){
            let promise = this;
            if (!(promise instanceof Object)) throw new TypeError
            let C = promise.constructor;
            let thenFinally, catchFinally;
            if (typeof onFinally !== 'function') {
                thenFinally = onFinally;
                catchFinally = onFinally;
            } else {
                // (0, ()=>{})写法的原因参考createResolvingFunction
                thenFinally = (0, (value) => {
                    let result = onFinally.call(undefined);
                    let promise = PromiseResolve(C, result);
                    let valueThunk = (0, () => {return value});
                    return promise.then(valueThunk)
                });
                catchFinally = (0, (reason) => {
                    let result = onFinally.call(undefined);
                    let promise = PromiseResolve(C, result);
                    let thrower = (0, () => {throw reason});
                    return promise.then(thrower)
                });
            }
            return promise.then(thenFinally, catchFinally)
        }

        get [Symbol.toStringTag](){
            return "Promise"
        }

        static all(iterable){
            // 27.2.4.1.2 PerformPromiseAll
            // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromiseall
            const PerformPromiseAll = (iteratorRecord, constructor, resultCapability, promiseResolve) => {
                let values = [];
                let remainingElementsCount = {Value:1};
                let index = 0;
                while(true) {
                    let next;
                    try {
                        let result = iteratorRecord.NextMethod.call(iteratorRecord.Iterator);
                        next = result.done ? false : result;
                    } catch(e){
                        iteratorRecord.Done = true;
                        throw e 
                    } 

                    if(!next) {
                        iteratorRecord.Done = true;
                        remainingElementsCount.Value --;
                        if (remainingElementsCount.Value === 0) {
                            let valuesArray = createArrayFromList(values);
                            resultCapability.Resolve.call(undefined, valuesArray);
                        }
                        return resultCapability.Promise
                    }

                    let nextValue;
                    try {
                        nextValue = next.value;
                    }catch(e){
                        iteratorRecord.Done = true;
                        throw e
                    }

                    values.push(undefined);
                    let nextPromise = promiseResolve.call(constructor, nextValue);

                    // 27.2.4.1.3 Promise.all Resolve Element Functions
                    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.all
                    // (0, ()=>{})写法的原因参考createResolvingFunction
                    const onFulfilled = (0, (x) => {
                        let F = onFulfilled;
                        if (F.AlreadyCalled) return undefined
                        F.AlreadyCalled = true;

                        let index = F.Index;
                        let values = F.Values;
                        let promiseCapability = F.Capability;
                        let remainingElementsCount = F.RemainingElements;
                        values[index] = x;
                        remainingElementsCount.Value --;
                        if (remainingElementsCount.Value === 0) {
                            let valuesArray = createArrayFromList(values);
                            promiseCapability.Resolve.call(undefined, valuesArray);
                        }
                        return undefined
                    });
                    onFulfilled.AlreadyCalled = false;
                    onFulfilled.Index = index;
                    onFulfilled.Values = values;
                    onFulfilled.Capability = resultCapability;
                    onFulfilled.RemainingElements = remainingElementsCount;
                    remainingElementsCount.Value ++;
                    nextPromise.then(onFulfilled, resultCapability.Reject);
                    index ++; 
                }
            };

            let C = this;
            let promiseCapability = NewPromiseCapability(C);

            
            let promiseResolve;
            try {
                promiseResolve = C.resolve;
                if (typeof promiseResolve !== 'function') throw new TypeError
            } catch(e) {
                promiseCapability.Reject.call(undefined, e);
                return promiseCapability.Promise
            }

            
            let iteratorRecord;
            try {
                let iterator = iterable[Symbol.iterator]();
                iteratorRecord = {
                    Iterator:iterator,
                    NextMethod: iterator.next,
                    Done: false
                };
            } catch(e){
                promiseCapability.Reject.call(undefined, e);
                return promiseCapability.Promise
            }

            let result; 
            try {
                result = PerformPromiseAll(iteratorRecord, C, promiseCapability, promiseResolve);   
            } catch(e){
                if (!iteratorRecord.Done) {
                    try {
                        let innerResult = iteratorRecord.Iterator.return;
                        if (innerResult !== undefined) {
                            innerResult = innerResult.call(iteratorRecord.Iterator);
                        }
                    } catch(err) {
                        e = err;
                    }
                }
                promiseCapability.Reject.call(undefined, e);
                return  promiseCapability.Promise
            }
            return result
        }

        static allSettled(iterable){
            // 27.2.4.2.1 PerformPromiseAllSettled 
            // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromiseallsettled
            const PerformPromiseAllSettled = (iteratorRecord, constructor, resultCapability, promiseResolve) => {
                let values = [];
                let remainingElementsCount = {Value:1};
                let index = 0;
                while(true) {
                    let next;
                    try {
                        let result = iteratorRecord.NextMethod.call(iteratorRecord.Iterator);
                        next = result.done ? false : result;
                    } catch(e){
                        iteratorRecord.Done = true;
                        throw e 
                    } 

                    if(!next) {
                        iteratorRecord.Done = true;
                        remainingElementsCount.Value --;
                        if (remainingElementsCount.Value === 0) {
                            let valuesArray = [...values];
                            resultCapability.Resolve.call(undefined, valuesArray);
                        }
                        return resultCapability.Promise
                    }

                    let nextValue;
                    try {
                        nextValue = next.value;
                    }catch(e){
                        iteratorRecord.Done = true;
                        throw e
                    }

                    values.push(undefined);

                    let nextPromise = promiseResolve.call(constructor, nextValue);

                    // 27.2.4.2.2 Promise.allSettled Resolve Element Functions
                    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.allsettled-resolve-element-functions
                    // (0, ()=>{})写法的原因参考createResolvingFunction
                    const onFulfilled = (0, (x) => {
                        let F = onFulfilled;
                        if (F.AlreadyCalled.value) return undefined
                        F.AlreadyCalled.value = true;

                        let index = F.Index;
                        let values = F.Values;
                        let promiseCapability = F.Capability;
                        let remainingElementsCount = F.RemainingElements;

                        let obj = {
                            "status":"fulfilled",
                            "value": x
                        };
                        values[index] = obj;

                        remainingElementsCount.Value --;
                        if (remainingElementsCount.Value === 0) {
                            let valuesArray = [...values];
                            promiseCapability.Resolve.call(undefined, valuesArray);
                        }
                        return undefined
                    });
                    let alreadyCalled = {Value: false};
                    onFulfilled.AlreadyCalled = alreadyCalled;
                    onFulfilled.Index = index;
                    onFulfilled.Values = values;
                    onFulfilled.Capability = resultCapability;
                    onFulfilled.RemainingElements = remainingElementsCount;

                    // 27.2.4.2.3 Promise.allSettled Reject Element Functions
                    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.allsettled-reject-element-functions
                    // (0, ()=>{})写法的原因参考createResolvingFunction
                    const onRejected = (0, (x) => {
                        let F = onRejected;
                        if (F.AlreadyCalled.value) return undefined
                        F.AlreadyCalled.value = true;

                        let index = F.Index;
                        let values = F.Values;
                        let promiseCapability = F.Capability;
                        let remainingElementsCount = F.RemainingElements;

                        let obj = {
                            "status":"rejected",
                            "reason": x
                        };
                        values[index] = obj;

                        remainingElementsCount.Value --;
                        if (remainingElementsCount.Value === 0) {
                            let valuesArray = [...values];
                            promiseCapability.Resolve.call(undefined, valuesArray);
                        }
                        return undefined
                    });
                    onRejected.AlreadyCalled = alreadyCalled;
                    onRejected.Index = index;
                    onRejected.Values = values;
                    onRejected.Capability = resultCapability;
                    onRejected.RemainingElements = remainingElementsCount;
                    
                    remainingElementsCount.Value ++;
                    nextPromise.then(onFulfilled, onRejected);
                    index ++; 
                }
            };

            let C = this;
            let promiseCapability = NewPromiseCapability(C);

            
            let promiseResolve;
            try {
                promiseResolve = C.resolve;
                if (typeof promiseResolve !== 'function') throw new TypeError
            } catch(e) {
                promiseCapability.Reject.call(undefined, e);
                return promiseCapability.Promise
            }

            
            let iteratorRecord;
            try {
                let iterator = iterable[Symbol.iterator]();
                iteratorRecord = {
                    Iterator:iterator,
                    NextMethod: iterator.next,
                    Done: false
                };
            } catch(e){
                promiseCapability.Reject.call(undefined, e);
                return promiseCapability.Promise
            }

            let result; 
            try {
                result = PerformPromiseAllSettled(iteratorRecord, C, promiseCapability, promiseResolve);   
            } catch(e){
                if (!iteratorRecord.Done) {
                    try {
                        let innerResult = iteratorRecord.Iterator.return;
                        if (innerResult !== undefined) {
                            innerResult = innerResult.call(iteratorRecord.Iterator);
                        }
                    } catch(err) {
                        e = err;
                    }
                }
                promiseCapability.Reject.call(undefined, e);
                return  promiseCapability.Promise
            }
            return result
        }
        
        static any(iterable){
            // 27.2.4.3.1 PerformPromiseAny
            // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromiseany
            const PerformPromiseAny = (iteratorRecord, constructor, resultCapability, promiseResolve) => {
                let errors = [];
                let remainingElementsCount = {Value:1};
                let index = 0;
                while(true) {
                    let next;
                    try {
                        let result = iteratorRecord.NextMethod.call(iteratorRecord.Iterator);
                        next = result.done ? false : result;
                    } catch(e){
                        iteratorRecord.Done = true;
                        throw e 
                    } 

                    if(!next) {
                        iteratorRecord.Done = true;
                        remainingElementsCount.Value --;
                        if (remainingElementsCount.Value === 0) {
                            let error = new AggregateError([...errors]);
                            throw error
                        }
                        return resultCapability.Promise
                    }

                    let nextValue;
                    try {
                        nextValue = next.value;
                    }catch(e){
                        iteratorRecord.Done = true;
                        throw e
                    }

                    errors.push(undefined);
                    let nextPromise = promiseResolve.call(constructor, nextValue);

                    // 27.2.4.3.2 Promise.any Reject Element Functions
                    // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.any-reject-element-functions
                    // (0, ()=>{})写法的原因参考createResolvingFunction
                    const onRejected = (0, (x) => {
                        let F = onRejected;
                        if (F.AlreadyCalled) return undefined
                        F.AlreadyCalled = true;

                        let index = F.Index;
                        let errors = F.Errors;
                        let promiseCapability = F.Capability;
                        let remainingElementsCount = F.RemainingElements;
                        errors[index] = x;
                        remainingElementsCount.Value --;
                        if (remainingElementsCount.Value === 0) {
                            let error = new AggregateError([...errors]);
                            promiseCapability.Reject.call(undefined, error);
                        }
                        return undefined
                    });
                    onRejected.AlreadyCalled = false;
                    onRejected.Index = index;
                    onRejected.Errors = errors;
                    onRejected.Capability = resultCapability;
                    onRejected.RemainingElements = remainingElementsCount;
                    remainingElementsCount.Value ++;
                    nextPromise.then(resultCapability.Resolve, onRejected);
                    index ++; 
                }
            };

            let C = this;
            let promiseCapability = NewPromiseCapability(C);

            
            let promiseResolve;
            try {
                promiseResolve = C.resolve;
                if (typeof promiseResolve !== 'function') throw new TypeError
            } catch(e) {
                promiseCapability.Reject.call(undefined, e);
                return promiseCapability.Promise
            }

            
            let iteratorRecord;
            try {
                let iterator = iterable[Symbol.iterator]();
                iteratorRecord = {
                    Iterator:iterator,
                    NextMethod: iterator.next,
                    Done: false
                };
            } catch(e){
                promiseCapability.Reject.call(undefined, e);
                return promiseCapability.Promise
            }

            let result; 
            try {
                result = PerformPromiseAny(iteratorRecord, C, promiseCapability, promiseResolve);   
            } catch(e){
                if (!iteratorRecord.Done) {
                    try {
                        let innerResult = iteratorRecord.Iterator.return;
                        if (innerResult !== undefined) {
                            innerResult = innerResult.call(iteratorRecord.Iterator);
                        }
                    } catch(err) {
                        e = err;
                    }
                }
                promiseCapability.Reject.call(undefined, e);
                return  promiseCapability.Promise
            }
            return result
        }
        static race(iterable){
            const PerformPromiseRace = ( iteratorRecord, constructor, resultCapability, promiseResolve ) => {
                while(true) {
                    let next;
                    try {
                        let result = iteratorRecord.NextMethod.call(iteratorRecord.Iterator);
                        next = result.done ? false : result;
                    } catch(e){
                        iteratorRecord.Done = true;
                        throw e 
                    } 

                    if(!next) {
                        iteratorRecord.Done = true;
                        return resultCapability.Promise
                    }

                    let nextValue;
                    try {
                        nextValue = next.value;
                    }catch(e){
                        iteratorRecord.Done = true;
                        throw e
                    }

                    let nextPromise = promiseResolve.call(constructor, nextValue);

                    nextPromise.then(resultCapability.Resolve, resultCapability.Reject);
                }
            };

            let C = this;
            let promiseCapability = NewPromiseCapability(C);

            let promiseResolve;
            try {
                promiseResolve = C.resolve;
                if (typeof promiseResolve !== 'function') throw new TypeError
            } catch(e) {
                promiseCapability.Reject.call(undefined, e);
                return promiseCapability.Promise
            }

            let iteratorRecord;
            try {
                let iterator = iterable[Symbol.iterator]();
                iteratorRecord = {
                    Iterator:iterator,
                    NextMethod: iterator.next,
                    Done: false
                };
            } catch(e){
                promiseCapability.Reject.call(undefined, e);
                return promiseCapability.Promise
            }

            let result; 
            try {
                result = PerformPromiseRace(iteratorRecord, C, promiseCapability, promiseResolve);   
            } catch(e){
                if (!iteratorRecord.Done) {
                    try {
                        let innerResult = iteratorRecord.Iterator.return;
                        if (innerResult !== undefined) {
                            innerResult = innerResult.call(iteratorRecord.Iterator);
                        }
                    } catch(err) {
                        e = err;
                    }
                }
                promiseCapability.Reject.call(undefined, e);
                return  promiseCapability.Promise
            }
            return result
        }
        static reject(r){
            let C = this;
            let promiseCapability = NewPromiseCapability(C);
            promiseCapability.Reject.call(undefined, r);
            return promiseCapability.Promise
        }
        static resolve(x){
            let C = this;
            if (!(C instanceof Object)) throw new TypeError
            return PromiseResolve(C, x)
        }

        static get [Symbol.species](){
            return this
        }
    };

    function PromiseResolve(C, x){
        if (IsPromise(x)) {
            let xConstructor = x.constructor;
            if (xConstructor === C) return x
        }
        let promiseCapability = NewPromiseCapability(C);
        promiseCapability.Resolve.call(undefined, x);
        return promiseCapability.Promise
    }

    function createArrayFromList(elements){
        const array = [];
        for (let i = 0; i < elements.length; i++){
            Object.defineProperty(array, i, {
                value: elements[i],
                writable: true,
                enumerable: false,
                configurable: true
            });
        }
        return array
    }

    if (!window.Promise) window.Promise = Promise$1;

    return Promise$1;

})();
