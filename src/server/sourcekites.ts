"use strict";

import * as server from "./server";

import {
  DocumentFormattingParams,
  TextEdit,
  Files,
  TextDocument,
  Range,
  Position
} from "vscode-languageserver";

import * as stream from "stream";
import * as yaml from "js-yaml";
import { ChildProcess } from "child_process";
import { editorSettings } from "./server";

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
  if (server.skProtocolProcessAsShellCmd) {
    return server.spawn(server.getShellExecPath(), [
      "-c",
      `docker run --rm -v ${server.workspaceRoot}:${
        server.workspaceRoot
      } -i jinmingjian/docker-sourcekite`
    ]);
  } else {
    return server.spawn(server.skProtocolPath);
  }
}

function initializeSKProtocolProcess() {
  debugLog(
    `***sourcekite initializing with skProtocolProcess at [${
      server.skProtocolPath
    }]`
  );

  const pathSourcekite = server.sdeSettings.path.sourcekite;

  skProtocolProcess = createSkProtocolProcess();
  skProtocolProcess.stderr.on("data", data => {
    if (server.isTracingOn) {
      debugLog("***stderr***" + data);
    }
  });
  skProtocolProcess.on("exit", function(code, signal) {
    debugLog("***sourcekite exited***" + `code: ${code}, signal: ${signal}`);
    debugLog("***sourcekite exited***" + "to spawn a new sourcekite process");
    //NOTE this is not guaranteed to reboot, but we just want it 'not guaranteed'
    skProtocolProcess = createSkProtocolProcess();
  });
  skProtocolProcess.on("error", function(err) {
    debugLog("***sourcekitd_repl error***" + (<Error>err).message);
    if ((<Error>err).message.indexOf("ENOENT") > 0) {
      const msg =
        "The '" +
        pathSourcekite +
        "' command is not available." +
        " Please check your swift executable user setting and ensure it is installed.";
      debugLog("***sourcekitd_repl not found***" + msg);
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
    debugLog("-->SourcekiteResponseHandler constructor done");
  }

  // private hasError = false
  private output = "";
  // private rid = -1
  private handleResponse(data): void {
    this.output += data;
    if (server.isTracingOn) {
      server.trace("", "" + data);
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
        debugLog(`---error: ${e}`);
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

type RequestType =
  | "codecomplete"
  | "cursorinfo"
  | "demangle"
  | "editor.open"
  | "editor.formattext";

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

  server.trace("to write request: ", request);
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

  const sourcePaths = server.getAllSourcePaths(srcPath);
  const loadedArgs = server.loadArgsImportPaths();
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
    ...(sourcePaths || [srcPath]),
    ...server.loadArgsImportPaths(),
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

//== editorFormatText
export function editorFormatText(
  document: TextDocument,
  srcText: string,
  srcPath: string,
  lineStart: number,
  lineEnd: number
): Promise<TextEdit[]> {
  return new Promise<TextEdit[]>((resolve, reject) => {
    let tes: TextEdit[] = [];
    editorOpen(srcPath, srcText, false, false, true)
      .then(v => {
        // discard v
        let p = requestEditorFormatText({
          file: srcPath,
          line: lineStart,
          document
        });

        //TODO async-await
        function nextp(fts: FormatTextState) {
          tes.push(fts.textEdit);
          if (fts.line != lineEnd) {
            let sPos: Position = { line: fts.line, character: 0 };
            let ePos: Position = document.positionAt(
              document.offsetAt({ line: fts.line + 1, character: 0 }) - 1
            );
            requestEditorFormatText({
              file: srcPath,
              line: fts.line + 1,
              document
            })
              .then(nextp)
              .catch(err => {
                reject(err);
              });
          } else {
            resolve(tes);
          }
        }

        p.then(nextp).catch(err => {
          reject(err);
        });
      })
      .catch(err => {
        reject(err);
      });
  });
}

//== editorOpen
function editorOpen(
  keyName: string,
  keySourcetext: string,
  keyEnableSyntaxMap: boolean,
  keyEnableSubStructure: boolean,
  keySyntacticOnly: boolean
): Promise<string> {
  keySourcetext = JSON.stringify(keySourcetext);
  let request = `{
  key.request: source.request.editor.open,
  key.name: "${keyName}",
  key.enablesyntaxmap: ${booleanToInt(keyEnableSyntaxMap)},
  key.enablesubstructure: ${booleanToInt(keyEnableSubStructure)},
  key.syntactic_only: ${booleanToInt(keySyntacticOnly)},
  key.sourcetext: ${keySourcetext},
  key.sourcetext: ${keySourcetext}
}

`;
  return typedResponse(request, "editor.open");
}

interface FormatTextState {
  line: number;
  textEdit: TextEdit;
}

interface SkFormatTextResponse {
  "key.line": number;
  "key.length": number;
  "key.sourcetext": string;
}

function requestEditorFormatText(options: {
  file: string;
  line: number;
  document: TextDocument;
}): Promise<FormatTextState> {
  const indentationOptions = !editorSettings.tabSize
    ? ""
    : `key.editor.format.options: {
            key.editor.format.indentwidth: ${editorSettings.tabSize},
            key.editor.format.tabwidth: ${editorSettings.tabSize},
            key.editor.format.usetabs: 0
          }`;
  let request = `{
  key.request: source.request.editor.formattext,
  key.name: "${options.file}",
  key.line: ${options.line},
  key.length: 1,
  ${indentationOptions}
}

`;
  let firstStartPos: Position = { line: options.line - 1, character: 0 };
  let firstEndPos: Position =
    options.line != options.document.lineCount
      ? options.document.positionAt(
          options.document.offsetAt({ line: options.line, character: 0 }) - 1
        )
      : options.document.positionAt(
          options.document.offsetAt({
            line: options.document.lineCount,
            character: 0
          })
        );
  const extraState = {
    keyLine: options.line,
    lineRange: { start: firstStartPos, end: firstEndPos } //NOTE format req is 1-based
  };
  return typedResponse(request, "editor.formattext").then(
    (resp: SkFormatTextResponse) => {
      const keyLine = extraState.keyLine;
      const lineRange = extraState.lineRange;
      return {
        line: keyLine,
        textEdit: {
          range: lineRange,
          newText: resp["key.sourcetext"]
        }
      };
    }
  );
}

function log<T>(prefix: string): (value: T) => T {
  return value => {
    console.log(prefix, value);
    return value;
  };
}

function debugLog(msg: string) {
  server.trace(msg);
}

function booleanToInt(v: boolean): Number {
  return v ? 1 : 0;
}
