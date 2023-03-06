function HostEnqueuePromiseJob(job){
    return queueMicrotask(job)
}

export {
    HostEnqueuePromiseJob
}