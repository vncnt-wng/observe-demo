from typing import Tuple, Dict, overload, Callable, TypeVar, ParamSpec
import os
import inspect
import subprocess
import re
import json
from functools import wraps
from flask import request
from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator


def get_git_root() -> str:
    completed_process = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], stdout=subprocess.PIPE
    )
    # [:-1] to remove endline
    return completed_process.stdout.decode("utf-8")[:-1] + "/"


"""
Returns the current commit, branch and message if available, else None
"""


def parse_git_reflog() -> Tuple[str, str, str]:
    # TODO ensure this parsing is sufficient
    """
    reflog of the form:
    af7ab5b (HEAD -> b2, master) HEAD@{0}: checkout: moving from master to b2
    af7ab5b (HEAD -> b2, master) HEAD@{1}: commit: test
    ba89296 (b1) HEAD@{2}: commit (initial): .
    """
    branch_name = check_git_repository()
    if branch_name != None:
        stdout_lines = (
            subprocess.run(["git", "reflog", "--decorate"], stdout=subprocess.PIPE)
            .stdout.decode("utf-8")
            .split("\n")
        )

        print(stdout_lines)
        for line in stdout_lines:
            substrings = line.split(": ")
            print(substrings)
            if "commit" in substrings[1]:
                commit_details = re.split(r"\(|\)", substrings[0])
                commit_id = commit_details[0][:-1]
                branches = commit_details[1].split("-> ")[1].split(", ")
                message = substrings[-1]
                # the first commit entry should start with current branch
                if branches[0] == branch_name:
                    branch = branch_name
                    return commit_id, branch, message
        return None, None, None


"""
Checks if a git repo exists, returns branch name if so or empty string
"""


def check_git_repository() -> str:
    completed_process = subprocess.run(["git", "status"], stdout=subprocess.PIPE)
    if completed_process.returncode == 0:
        return (
            completed_process.stdout.decode("utf-8")
            .split("\n")[0]
            .split("On branch ")[1]
        )
    return None


git_root = None
tracer = trace.get_tracer(__name__)
commit_id, branch, message = None, None, None

if check_git_repository():
    git_root = get_git_root()
    commit_id, branch, message = parse_git_reflog()


# dumps a class object to json (shallow)
def dump_obj_to_json(obj):
    data = {}
    data["type"] = "class"
    data["className"] = type(obj).__name__
    values = obj.__dict__
    for key in values.keys():
        typeObj = type(values[key])
        # if attribute is an object, just record the class name
        if "__dict__" in typeObj.__dict__:
            values[key] = {"class": typeObj.__name__}
    data["values"] = values
    return json.dumps(data)


def header_from_carrier(carrier, key):
    header = carrier.get(key)
    return [header] if header else []


def get_header_from_flask_request(request, key):
    return request.headers.get_all(key)


"""
Wrapper function that starts a new otel trace on a function, recording function details as attributes
"""


def trace_function(func):
    def wrapper(*args, **kwargs):
        localParent = trace.get_current_span()
        print(localParent)
        print(localParent.get_span_context().span_id == 0)
        ctx = None
        try:
            traceparent = get_header_from_flask_request(request, "traceparent")
            print(traceparent)
            carrier = {"traceparent": traceparent[0]}
            ctx = (
                TraceContextTextMapPropagator().extract(carrier)
                if localParent.get_span_context().span_id == 0
                else None
            )
        except:
            print("could not get trace parent")
            print(request.headers)
            pass

        with tracer.start_as_current_span(f"{func.__name__}", context=ctx) as span:
            try:
                if localParent.get_span_context().span_id == 0 and (
                    "traceparent" in request.headers or "Traceparent" in request.headers
                ):
                    print("here")
                    # request.headers.traceparent = None
                    # request.headers["Traceparent"] = None
                    print(request.headers)
                    span.set_attribute("parentFromOtherService", True)
            except:
                print("error")
                pass

            absolute_path = os.path.abspath(inspect.getfile(func))
            span.set_attribute(f"file", absolute_path.replace(git_root, ""))
            qualname = func.__qualname__
            span.set_attribute(f"qualName", qualname)

            # If function in a class, don't add 'self' arg to trace attributes
            arg_start = 0
            if len(qualname.split(".")) > 1:
                arg_start = 1

            func_args = list(inspect.signature(func).parameters.keys())
            for n in range(arg_start, len(args)):
                print("__dict__" in type(args[n]).__dict__)
                print(type(args[n]).__name__)
                if "__dict__" in type(args[n]).__dict__:
                    span.set_attribute(func_args[n], dump_obj_to_json(args[n]))
                    # args_data[func_args[n]] = dump_obj_to_json(args[n])
                elif type(args[n]).__name__ == "dict":
                    span.set_attribute(
                        func_args[n], json.dumps({"type": "dict", "value": args[n]})
                    )
                elif type(args[n]).__name__ == "set":
                    span.set_attribute(
                        func_args[n],
                        json.dumps({"type": "set", "value": list(args[n])}),
                    )
                elif type(args[n]).__name__ == "list":
                    span.set_attribute(
                        func_args[n], json.dumps({"type": "list", "value": args[n]})
                    )
                else:
                    span.set_attribute(func_args[n], args[n])
                    # args_data[func_args[n]] = args[n]

            if branch:
                span.set_attribute("commit_id", commit_id)
                span.set_attribute("branch", branch)
                span.set_attribute("message", message)

            return func(*args, **kwargs)

    wrapper.__name__ = func.__name__
    return wrapper


# Adds trace headers to a header dictionary
def add_trace_headers(headers: Dict):
    carrier = {}
    TraceContextTextMapPropagator().inject(carrier)
    # For W3c trace context convention
    headers["traceparent"] = carrier["traceparent"]
    headers["callerSpanId"] = hex(trace.get_current_span().get_span_context().span_id)
    trace.get_current_span().set_attribute("childInOtherService", True)
    print(headers)
    return headers
