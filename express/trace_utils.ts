import { ChildProcess, execSync } from "child_process";
import opentelemetry, { trace, context, propagation, Span } from "@opentelemetry/api";


const getGitRoot = (): string => {
    const result = execSync("git rev-parse --show-toplevel")
    return result.toString().split('\n')[0] + '/'
}

// Check is repo exists, 
const checkGitRepository = (): string | undefined => {
    const result = execSync("git status")
    try {
        return result.toString().split("\n")[0].split("On branch ")[1]
    } catch {
        return undefined
    }
}

const parseGitReflog = (): Object => {
    const branchName = checkGitRepository()
    if (branchName) {
        const result = execSync("git reflog --decorate")
        const lines = result.toString().split("\n")
        for (const line of lines) {
            const substrings = line.split(": ")
            if (substrings[1] === "commit") {
                const wholeDetailsString = substrings[0].replace('(', ')')
                const commit_details = wholeDetailsString.split(")")
                const commit_id = commit_details[0].slice(0, commit_details[0].length - 2)
                const branches = commit_details[1].split("-> ")[1].split(", ")
                const message = substrings[substrings.length - 1]
                // the first commit entry should start with current branch
                if (branches[0] === branchName) {
                    const branch = branches[0]
                    return { commit_id, branch, message }
                }
            }
        }

    }
    return { commit_id: undefined, branch: undefined, message: undefined }
}

const checkGit = checkGitRepository()
const git_root = checkGit ? getGitRoot() : undefined
// @ts-ignore
const { commit_id, branch, message } = checkGit ? parseGitReflog() : { commit_id: undefined, branch: undefined, message: undefined }

function _getCallerFile() {
    let filename = '';

    var _pst = Error.prepareStackTrace
    Error.prepareStackTrace = function (err, stack) { return stack; };
    try {
        var err: Error = new Error();
        let found = false;
        for (const span of err.stack) {
            // Find the first file in the call stack that is not from trace_utils
            // @ts-ignore
            if (span.getFileName() !== __filename) {
                found = true
                // @ts-ignore
                filename = span.getFileName()
                break;
            }
        }

        if (!found) {
            console.log("Could not find caller file in stack")
        }
    } catch (err) { }
    Error.prepareStackTrace = _pst;

    return String(filename);
}


const tracer = opentelemetry.trace.getTracer(
    'my-service-tracer'
);

export function traceFunction(target: any, propertyName: string, descriptor: TypedPropertyDescriptor<Function>) {
    let method = descriptor.value!;
    console.log("trace function")
    console.log(context.active())
    const filePath = _getCallerFile()
    descriptor.value = function (...args: any[]) {
        return tracer.startActiveSpan(propertyName, (span: Span) => {
            const result = method.apply(this, args)
            setSpanAttributes(filePath, propertyName, this, span)
            span.end()
            return result
        })
    };
}


export function traceFunctionAsync(target: any, propertyName: string, descriptor: TypedPropertyDescriptor<Function>) {
    let method = descriptor.value!;
    const filePath = _getCallerFile()
    descriptor.value = async function (...args: any[]) {
        return tracer.startActiveSpan(propertyName, async (span: Span) => {
            const result = await method.apply(this, args)
            setSpanAttributes(filePath, propertyName, this, span)
            span.end()
            return result
        })
    };
}

const setSpanAttributes = (filePath: string, name: string, context: Object, span: Span) => {
    const pathFromGitRoot = String(filePath).replace(String(git_root), '')

    const qualName = context && context.constructor ? context.constructor.name + "." + name : name
    span.setAttribute("qualName", qualName)
    span.setAttribute("file", pathFromGitRoot)
    if (checkGit) {
        span.setAttribute("commit_id", commit_id)
        span.setAttribute("branch", branch)
        span.setAttribute("message", message)
    }
}


export const traceFunctionMiddleWare = (req, res, next) => {
    const filePath = _getCallerFile()
    let activeContext = undefined
    if (req.headers.hasOwnProperty("traceparent")) {
        activeContext = propagation.extract(context.active(), req.headers)
    }
    const name = "app.post('" + req.originalUrl + "')"
    return tracer.startActiveSpan(name,
        {},
        activeContext, (span) => {
            if (activeContext != undefined) {
                span.setAttribute("parentFromOtherService", true)
            }
            setSpanAttributes(filePath, name, undefined, span)
            next()
            span.end()
        }
    )
}

export const setCorrectFileForMiddlewareSpan = (pathFromGitRoot: string = undefined) => {
    if (pathFromGitRoot == undefined) {
        const fullPath = _getCallerFile()
        pathFromGitRoot = String(fullPath).replace(String(git_root), '')
    }
    // If from middleware, will be top level, qualname and file will be the same 
    trace.getActiveSpan().setAttribute("file", pathFromGitRoot)
}

export const traceFunctionCallback = (name: string, callback: Function) => {
    const filePath = _getCallerFile()
    return tracer.startActiveSpan(name, (span) => {
        setSpanAttributes(filePath, name, undefined, span)
        const returnValue = callback.apply(undefined)
        span.end()
        return returnValue
    });
}


export const getTraceContextHeaders = () => {
    const output = {}
    propagation.inject(context.active(), output);
    // not necessary, we flag children - trace.getActiveSpan().setAttribute("childInOtherService", true)
    return output
}

