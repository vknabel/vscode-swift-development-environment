"use strict";

import { Diagnostic, DiagnosticSeverity, Range, Uri, window as vscodeWindow } from "vscode";
import { diagnosticCollection } from "./clientMain";
import { isBuildTracingOn } from "./config-helpers";
import output from "./output-channels";
import { statusBarItem } from "./status-bar";
import cp = require("child_process");

function trace(...msg: any[]) {
  if (isBuildTracingOn()) {
    console.log(...msg);
  }
}

///managed build now only support to invoke on save
export function buildPackage(swiftBinPath: string, pkgPath: string, params: string[]) {
  output.build.log("Build Started");
  const buildProc = cp.spawn(swiftBinPath, params, { cwd: pkgPath, shell: true });
  buildProc.stdout.on("data", data => {
    const msg = `${data}`.trim();
    if (msg.length) {
      output.build.log(msg);
    }
  });
  buildProc.stderr.on("data", data => {
    const msg = `${data}`.trim();
    if (msg.length) {
      output.build.log(`Error - ${msg}`);
    }
  });
  buildProc.on("error", function(err: Error) {
    trace("***swift build command error*** " + err.message);
    if (err.message.indexOf("ENOENT") > 0) {
      const msg =
        "The '" +
        swiftBinPath +
        "' command is not available." +
        " Please check your swift executable user setting and ensure it is installed.";
      vscodeWindow.showErrorMessage(msg);
    }
  });

  buildProc.on("exit", function(code, signal) {
    trace(`***swift build command exited*** code: ${code}, signal: ${signal}`);
    output.build.log("\n");
    diagnosticCollection.clear();
    dumpDiagnostics();

    if (code != 0) {
      statusBarItem.buildFailed();
      output.build.log("Build Failed");
    } else {
      statusBarItem.buildSucceeded();
      output.build.log("Build Succeeded");
    }
  });
}

function dumpDiagnostics() {
  const diagnosticMap: Map<string, Diagnostic[]> = new Map();
  let diags: Array<string[]> = [];
  const lines = stdout.split("\n");

  function isDiagStartLine(line: string) {
    //FIXME
    const sa = line.split(":");
    if (sa.length > 4) {
      const sev = sa[3].trim();
      return sev == "error" || sev == "warning" || sev == "note";
    }
    return false;
  }
  //FIXME always the pattern?
  function makeDiagnostic(oneDiag: string[]) {
    const line0 = oneDiag[0];
    const line1 = oneDiag[1];
    const line2 = oneDiag[2];
    const sa = line0.split(":");
    const file = Uri.file(sa[0]).toString(); //FIXME not always file, Swift._cos:1:13:
    //line and column in vscode is 0-based
    const line = Number(sa[1]) - 1;
    const startColumn: number = Number(sa[2]) - 1;
    const sev = toVSCodeSeverity(sa[3].trim());
    const msg = sa[4];
    const endColumn: number = startColumn + line2.trim().length;

    // let canonicalFile = vscode.Uri.file(error.file).toString();
    // if (document && document.uri.toString() === canonicalFile) {
    //     let range = new vscode.Range(error.line - 1, 0, error.line - 1, document.lineAt(error.line - 1).range.end.character + 1);
    //     let text = document.getText(range);
    //     let [_, leading, trailing] = /^(\s*).*(\s*)$/.exec(text);
    //     startColumn = leading.length;
    //     endColumn = text.length - trailing.length;
    // }
    let range = new Range(line, startColumn, line, endColumn);
    let diagnostic = new Diagnostic(range, msg, sev);
    let diagnostics = diagnosticMap.get(file);
    if (!diagnostics) {
      diagnostics = [];
    }
    diagnostics.push(diagnostic);
    diagnosticMap.set(file, diagnostics);
  }

  let index = Number.MAX_VALUE;
  let line, oneDiag, hasDiagStart;
  for (let i = 0; i < lines.length; i++) {
    line = lines[i];
    if (isDiagStartLine(line)) {
      if (!hasDiagStart) hasDiagStart = true;
      if (oneDiag) diags.push(oneDiag);
      oneDiag = [];
    }
    if (hasDiagStart) {
      oneDiag.push(line);
    }
  }
  diags.push(oneDiag); //push last oneDiag
  diags.forEach(d => {
    if (d) {
      makeDiagnostic(d);
    }
  });
  diagnosticMap.forEach((diags, file) => {
    diagnosticCollection.set(Uri.parse(file), diags);
  });
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
      return DiagnosticSeverity.Information; //FIXME
  }
}
