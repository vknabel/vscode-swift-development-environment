"use strict";

import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Duplex, Readable, Stream } from "stream";
import {
  commands,
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  Disposable,
  languages,
  Range,
  Uri,
  workspace,
} from "vscode";
import * as config from "../vscode/config-helpers";
import output, { LogStream } from "../vscode/output-channels";
import { statusBarItem } from "../vscode/status-bar";

type OnProcExit = (code: number, signal: NodeJS.Signals) => void;
type ChildProc = cp.ChildProcessWithoutNullStreams;
type ProcAndOutput = { proc: ChildProc; output: Promise<string> };

const DiagnosticFirstLine = /(.+?):(\d+):(\d+): (error|warning|note|.+?): (.+)/;

export function setRunning(isRunning: boolean) {
  commands.executeCommand("setContext", "sde:running", isRunning);
}

export function swiftPackageExists(): boolean {
  const manifestPath = workspace.workspaceFolders
    ? path.join(workspace.workspaceFolders[0].uri.fsPath, "Package.swift")
    : null;
  return manifestPath && fs.existsSync(manifestPath);
}

export function shouldBuildOnSave(): boolean {
  return config.buildOnSave() && swiftPackageExists();
}

export class Toolchain {
  private swiftBinPath: string;
  private basePath: string;
  private buildArgs: string[];
  private buildProc?: ChildProc;
  private runProc?: ChildProc;
  private _diagnostics?: DiagnosticCollection;

  constructor(swiftPath: string, pkgBasePath: string, args: string[]) {
    this.swiftBinPath = swiftPath;
    this.basePath = pkgBasePath;
    this.buildArgs = args;
  }

  // Getters
  get isRunning(): boolean {
    return this.runProc != undefined;
  }

  get diagnostics(): DiagnosticCollection {
    if (!this._diagnostics) {
      this._diagnostics = languages.createDiagnosticCollection("swift");
    }
    return this._diagnostics;
  }

  // Public API
  /**
   * @returns A Disposable that can be used to stop this instance of the Toolchain
   */
  start(): Disposable {
    return {
      dispose: () => this.stop(),
    };
  }

  /**
   * Stops this instance of the Toolchain
   */
  stop() {
    if (this.buildProc) {
      console.log("Stopping build proc");
    }
    this.buildProc?.kill();
    if (this.runProc) {
      console.log("Stopping run proc");
    }
    this.runProc?.kill();
  }

  private spawnSwiftProc(args: string[], logs: LogStream, onExit: OnProcExit): ProcAndOutput {
    // let oPipe = new Duplex({ highWaterMark: 1024, allowHalfOpen: false });
    // let ePipe = new Duplex({ highWaterMark: 1024, allowHalfOpen: false });
    const proc = cp.spawn(this.swiftBinPath, args, {
      cwd: this.basePath,
      // stdio: ["ignore", oPipe, ePipe],
    });
    proc.stderr.on("data", data => {
      logs.write(`${data}`);
    });
    let stdout = "";
    proc.stdout.on("data", data => {
      stdout += data;
      logs.write(`${data}`);
    });
    const promise = new Promise<string>((resolve, reject) => {
      logs.log(`pid: ${proc.pid} - ${this.swiftBinPath} ${args.join(" ")}`);
      proc.on("error", err => {
        logs.log(`[Error] ${err.message}`);
        reject(err);
      });
      proc.on("exit", (code, signal) => {
        resolve(stdout);
        onExit(code, signal);
      });
    });
    return { proc, output: promise };
  }

  build(target: string = "") {
    output.build.clear();
    output.build.log("-- Build Started --");
    const start = Date.now();
    const buildArgs = [...this.buildArgs];
    if (target) {
      buildArgs.unshift(target);
    }
    if (!["build", "test"].includes(buildArgs[0])) {
      buildArgs.unshift("build");
    }
    statusBarItem.start();
    try {
      const { proc, output: buildOutput } = this.spawnSwiftProc(buildArgs, output.build, code => {
        const duration = Date.now() - start;
        if (code != 0) {
          statusBarItem.failed();
          output.build.log(`-- Build Failed (${(duration / 1000).toFixed(1)}s) --`, true);
        } else {
          statusBarItem.succeeded();
          output.build.log(`-- Build Succeeded (${(duration / 1000).toFixed(1)}s) --`);
        }
        this.buildProc = undefined;
      });
      buildOutput.then(buildOutput => this.generateDiagnostics(buildOutput));
      this.buildProc = proc;
    } catch (e) {
      console.log(e);
    }
  }

  private generateDiagnostics(buildOutput: string = "") {
    this._diagnostics.clear();
    const newDiagnostics = new Map<string, Diagnostic[]>();
    const lines = buildOutput.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(DiagnosticFirstLine);
      if (!match) {
        // console.log(`line did not match - '${line}'`);
        continue;
        //       } else {
        //         console.log(`found diagnostic -
        // ${line}
        // ${lines[i + 1]}
        // ${lines[i + 2]}
        // -------`);
        //   console.log(match);
      }
      const [_, file, lineNumStr, startColStr, swiftSev, message] = match;
      // vscode used 0 indexed lines and columns
      const lineNum = parseInt(lineNumStr, 10) - 1;
      const startCol = parseInt(startColStr, 10) - 1;
      const endCol = lines[i + 2].trimEnd().length - 1;
      const range = new Range(lineNum, startCol, lineNum, endCol);
      const diagnostic = new Diagnostic(range, message, toVSCodeSeverity(swiftSev));
      diagnostic.source = "sourcekitd";
      if (!newDiagnostics.has(file)) {
        newDiagnostics.set(file, []);
      }
      newDiagnostics.get(file).push(diagnostic);
    }
    for (const entry of newDiagnostics) {
      const [file, diagnostics] = entry;
      if (file.includes("checkouts")) {
        continue;
      }
      // TODO: check for overlapping diagnostic ranges and collapse into `diagnostic.relatedInformation`
      const uri = Uri.parse(file);
      // TODO: check to see if sourcekitd already has diagnostics for this file
      this._diagnostics.set(uri, diagnostics);
    }
  }

  runStart(target: string = "") {
    setRunning(true);
    output.run.clear();
    output.run.log(`running ${target ? target : "package"}…`);
    const { proc } = this.spawnSwiftProc(
      target ? ["run", target] : ["run"],
      output.run,
      (code, signal) => {
        // handle termination here
        output.run.log(`Process exited. code=${code} signal=${signal}`);
        setRunning(false);
        this.runProc = undefined;
      }
    );
    this.runProc = proc;
  }

  runStop() {
    setRunning(false);
    output.run.log(`stopping`);
    this.runProc.kill();
    this.runProc = undefined;
  }

  clean() {
    statusBarItem.start("cleaning");
    this.spawnSwiftProc(["package clean"], output.build, (code, signal) => {
      statusBarItem.succeeded("clean");
      output.build.log("done");
    });
  }
}

function toVSCodeSeverity(sev: string) {
  switch (sev) {
    case "error":
      return DiagnosticSeverity.Error;
    case "warning":
      return DiagnosticSeverity.Warning;
    case "note":
      return DiagnosticSeverity.Information;
    default:
      return DiagnosticSeverity.Hint; //FIXME
  }
}
