"use strict";

import * as fs from "fs";
import * as tools from "./SwiftTools";
import * as path from "path";
import {
  commands,
  DiagnosticCollection,
  ExtensionContext,
  languages,
  TextDocument,
  window,
  workspace,
} from "vscode";
import { absolutePath } from "./helpers/AbsolutePath";
import * as config from "./vscode/config-helpers";
import lsp from "./vscode/lsp-interop";
import output from "./vscode/output-channels";
import { statusBarItem } from "./vscode/status-bar";

let swiftBinPath: string | null = null;
let swiftBuildParams: string[] = ["build"];
let swiftPackageManifestPath: string | null = null;
let skProtocolProcess: string | null = null;
let skProtocolProcessAsShellCmd: string | null = null;
export let diagnosticCollection: DiagnosticCollection;

export function activate(context: ExtensionContext) {
  output.init(context);

  if (workspace.getConfiguration().get<boolean>("sde.enable") === false) {
    output.build.log("SDE Disabled", false);
    return;
  }
  output.build.log("Activating SDE");

  initConfig();
  lsp.startLSPClient(context);

  diagnosticCollection = languages.createDiagnosticCollection("swift");
  context.subscriptions.push(diagnosticCollection);

  //commands
  context.subscriptions.push(
    commands.registerCommand("sde.commands.buildPackage", buildSPMPackage),
    commands.registerCommand("sde.commands.restartLanguageServer", () =>
      lsp.restartLSPClient(context)
    ),
    commands.registerCommand("sde.commands.runPackage", () => {
      output.build.log("sde.commands.runPackage");
    })
  );

  workspace.onDidSaveTextDocument(onSave, null, context.subscriptions);

  // respond to settings changes
  workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration("sde")) {
      // reload things as necessary
    }
  });

  // build on startup
  buildSPMPackage();
}

function initConfig() {
  checkToolsAvailability();

  //FIXME rootPath may be undefined for adhoc file editing mode???
  swiftPackageManifestPath = workspace.workspaceFolders[0]
    ? path.join(workspace.workspaceFolders[0].uri.fsPath, "Package.swift")
    : null;
}

function buildSPMPackage() {
  if (isSPMProject()) {
    statusBarItem.start();
    tools.buildPackage(swiftBinPath, workspace.rootPath, swiftBuildParams);
  }
}

function onSave(document: TextDocument) {
  if (config.buildOnSave() && document.languageId === "swift") {
    buildSPMPackage();
  }
}

function isSPMProject(): boolean {
  return swiftPackageManifestPath ? fs.existsSync(swiftPackageManifestPath) : false;
}

function checkToolsAvailability() {
  swiftBinPath = absolutePath(workspace.getConfiguration().get("swift.path.swift_driver_bin"));
  swiftBuildParams = <string[]>workspace.getConfiguration().get("sde.swiftBuildingParams") || [
    "build",
  ];
  const sourcekitePath = absolutePath(workspace.getConfiguration().get("swift.path.sourcekite"));
  const sourcekitePathEnableShCmd = workspace
    .getConfiguration()
    .get<string>("swift.path.sourcekiteDockerMode");
  const shellPath = absolutePath(workspace.getConfiguration().get("swift.path.shell"));
  skProtocolProcess = sourcekitePath;
  skProtocolProcessAsShellCmd = sourcekitePathEnableShCmd;

  if (!swiftBinPath || !fs.existsSync(swiftBinPath)) {
    window.showErrorMessage(
      'missing dependent swift tool, please configure correct "swift.path.swift_driver_bin"'
    );
  }
  if (!sourcekitePathEnableShCmd) {
    if (!skProtocolProcess || !fs.existsSync(skProtocolProcess)) {
      window.showErrorMessage(
        'missing dependent sourcekite tool, please configure correct "swift.path.sourcekite"'
      );
    }
  }
  if (!shellPath || !fs.existsSync(shellPath)) {
    window.showErrorMessage(
      'missing dependent shell tool, please configure correct "swift.path.shell"'
    );
  }
}
