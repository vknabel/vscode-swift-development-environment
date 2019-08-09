"use strict";

import * as server from "./server";

import * as yaml from "js-yaml";
import { ChildProcess } from "child_process";
import { Current } from "./current";

let skProtocolProcess: ChildProcess | null = null;
let skeHandler: SourcekiteResponseHandler | null = null;
export function initializeSourcekite() {
  if (skProtocolProcess == null) {
    initializeSKProtocolProcess();
  }
}

function terminateSourcekite() {
  if (skProtocolProcess != null) {
    skProtocolProcess.kill();
  }
}

function restartSourcekite() {
  terminateSourcekite();
  initializeSourcekite();
}

function createSkProtocolProcess() {
  const env = { TOOLCHAIN_DIR: Current.config.toolchainPath };
  if (server.skProtocolProcessAsShellCmd) {
    const volumes = Current.config.workspacePaths.map(
      path => `-v '${path}:${path}'`
    );
    return server.spawn(
      server.getShellExecPath(),
      ["-c", `docker run --rm ${volumes} -i jinmingjian/docker-sourcekite`],
      { env }
    );
  } else {
    return server.spawn(server.skProtocolPath, [], { env });
  }
}

function initializeSKProtocolProcess() {
  Current.log(
    "sourcekite",
    `***sourcekite initializing with skProtocolProcess at [${
      server.skProtocolPath
    }]`
  );

  const pathSourcekite = Current.config.sourcekitePath;

  skProtocolProcess = createSkProtocolProcess();
  skProtocolProcess.stderr.on("data", data => {
    Current.log("sourcekite", "***stderr***" + data);
  });
  skProtocolProcess.on("exit", function(code, signal) {
    Current.log("sourcekite", "[exited]", `code: ${code}, signal: ${signal}`);
    //NOTE this is not guaranteed to reboot, but we just want it 'not guaranteed'
    skProtocolProcess = createSkProtocolProcess();
  });
  skProtocolProcess.on("error", function(err) {
    Current.log(
      "sourcekite",
      "***sourcekitd_repl error***" + (<Error>err).message
    );
    if ((<Error>err).message.indexOf("ENOENT") > 0) {
      const msg =
        "The '" +
        pathSourcekite +
        "' command is not available." +
        " Please check your swift executable user setting and ensure it is installed.";
      Current.log("sourcekite", "***sourcekitd_repl not found***" + msg);
    }
    throw err;
  });
  skeHandler = new SourcekiteResponseHandler();
}

enum ParsingState {
  endResponse,
  startResponseContent
}

//assumption:single-thread
class SourcekiteResponseHandler {
  private static nResponsesSlot = 64; //FIXME config options?
  // private static responseTimeoutMills = 15 * 1000 //FIXME

  private rids = new Array<number>(SourcekiteResponseHandler.nResponsesSlot); //for checking
  private responses = new Array<any>(SourcekiteResponseHandler.nResponsesSlot);
  private responsesProcessed = Array.from(
    new Array<boolean>(SourcekiteResponseHandler.nResponsesSlot)
  ).map((_, i) => true);
  private responseResolves = new Array<Function>(
    SourcekiteResponseHandler.nResponsesSlot
  );
  private responseRejects = new Array<Function>(
    SourcekiteResponseHandler.nResponsesSlot
  );

  constructor() {
    skProtocolProcess.stdout.on("data", this.handleResponse.bind(this));
    Current.log("-->SourcekiteResponseHandler constructor done");
  }

  // private hasError = false
  private output = "";
  // private rid = -1
  private handleResponse(data): void {
    this.output += data;
    if (Current.config.isTracingOn) {
      Current.log("SourcekiteResponseHandler", `${data}`);
    }
    if (this.output.endsWith("}\n\n")) {
      const idx = this.output.indexOf("\n");
      const ridstr = this.output.substring(0, idx);
      const rid = parseInt(ridstr);
      if (isNaN(rid)) {
        throw new Error("wrong format for reqid");
      }
      const res = this.output.substring(idx + 1);
      const slot = this.getSlot(rid);
      const resolve = this.responseResolves[slot];
      const reject = this.responseRejects[slot];
      this.output = "";
      this.responsesProcessed[slot] = true;
      try {
        resolve(res);
      } catch (e) {
        Current.log(`---error: ${e}`);
        reject(e);
      }
    }
  }

  public getResponse(rid: number): Promise<string> {
    // const start = new Date().getTime() //FIXME enable timeout?
    return new Promise((resolve, reject) => {
      const slot = this.getSlot(rid);
      //FIXME enable timeout?reject only when covered by next replacer
      if (!this.responsesProcessed[slot]) {
        const rjt = this.responseRejects[slot];
        rjt(`fail to process the request[reqid=${this.rids[slot]}]`);
      }
      this.rids[slot] = rid;
      this.responseResolves[slot] = resolve;
      this.responseRejects[slot] = reject;
      this.responsesProcessed[slot] = false;
    });
  }

  private getSlot(rid: number): number {
    return rid % SourcekiteResponseHandler.nResponsesSlot;
  }
}

let reqCount = 0; //FIXME

type RequestType = "codecomplete" | "cursorinfo" | "demangle" | "editor.open";

function pluck<T, K extends keyof T>(prop: K): (ofTarget: T) => T[K] {
  return target => target[prop];
}

function typedResponse<T>(
  request: string,
  requestType: RequestType,
  extraState: any = null,
  retries = 0
): Promise<T> {
  function parseSkResponse(resp: string): any {
    return yaml.safeLoad(resp);
  }

  Current.log("request", request);
  const rid = reqCount++;
  skProtocolProcess.stdin.write(rid + "\n");
  skProtocolProcess.stdin.write(request);
  return skeHandler
    .getResponse(rid)
    .catch(e => {
      console.log("Request did fail", requestType, e);
      if (retries > 5) {
        console.log("Request failed too many times. Abort.");
        throw "Request failed too many times. Abort.";
      } else {
        restartSourcekite();
        return typedResponse(request, requestType, extraState, retries);
      }
    })
    .then(parseSkResponse);
}

function request(
  requestType: RequestType,
  srcText: string,
  srcPath: string,
  offset: number
): Promise<any> {
  function targetArgumentsForImport(
    lib: string,
    platform: string,
    target: string
  ): string[] | null {
    return loadedArgs.indexOf("-target") === -1 &&
      srcText.includes(`import ${lib}`)
      ? [
          "-target",
          target,
          "-sdk",
          `/Applications/Xcode.app/Contents/Developer/Platforms/${platform}.platform/Developer/SDKs/${platform}.sdk`
        ]
      : null;
  }
  function defaultTargetArguments() {
    if (loadedArgs.indexOf("-target") !== -1) {
      return [];
    }
    return process.platform === "linux"
      ? ["-target", "x86_64-unknown-linux"]
      : [
          "-target",
          "x86_64-apple-macosx10.10",
          "-sdk",
          `/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk`
        ];
  }

  const target = server.targetForSource(srcPath);
  const sourcePaths = Array.from(target.sources);
  const loadedArgs = target.compilerArguments;
  /*const inferredOSArgs = process.platform === 'darwin'
        ? ["-target", "x86_64-apple-macosx10.10"]*/
  const inferredTargetArgs =
    targetArgumentsForImport("UIKit", "iPhoneOS", "arm64-apple-ios11.0") ||
    targetArgumentsForImport(
      "WatchKit",
      "WatchOS",
      "armv7k-apple-watchos4.0"
    ) ||
    targetArgumentsForImport("AppKit", "MacOSX", "x86_64-apple-macosx10.10") ||
    defaultTargetArguments();
  const compilerargs = JSON.stringify([
    ...target.compilerArguments,
    ...(sourcePaths || [srcPath]),
    ...inferredTargetArgs
  ]);

  srcText = JSON.stringify(srcText);
  let request = `{
  key.request: source.request.${requestType},
  key.sourcefile: "${srcPath}",
  key.offset: ${offset},
  key.compilerargs: ${compilerargs},
  key.sourcetext: ${srcText}
}

`;
  return typedResponse(request, requestType);
}

//== codeComplete
export function codeComplete(
  srcText: string,
  srcPath: string,
  offset: number
): Promise<any> {
  return request("codecomplete", srcText, srcPath, offset).then(
    pluck("key.results")
  );
}

//== cursorInfo
export function cursorInfo(
  srcText: string,
  srcPath: string,
  offset: number
): Promise<any> {
  return request("cursorinfo", srcText, srcPath, offset);
}

//== demangle
export function demangle(...demangledNames: string[]): Promise<any> {
  const names = JSON.stringify(demangledNames.join(","));
  let request = `{
  key.request: source.request.demangle,
  key.names: [${names}]
}

`;
  return typedResponse<any>(request, "demangle").then(pluck("key.results"));
}
