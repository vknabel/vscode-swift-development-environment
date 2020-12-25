"use strict";

import * as path from "path";
import * as fs from "fs";
import * as tools from "./SwiftTools";
import {
  workspace,
  window,
  commands,
  languages,
  ExtensionContext,
  DiagnosticCollection,
  OutputChannel,
  TextDocument,
} from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient";
import { absolutePath } from "./AbsolutePath";

import * as config from "./config-helpers";
import output from "./output-channels";
import { LangaugeServerMode } from "./config-helpers";

import { statusBarItem } from "./status-bar";

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

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [
      { language: "swift", scheme: "file" },
      { pattern: "*.swift", scheme: "file" },
    ],
    synchronize: {
      configurationSection: ["swift", "editor", "[swift]"],
      // Notify the server about file changes to '.clientrc files contain in the workspace
      fileEvents: [
        workspace.createFileSystemWatcher("**/*.swift"),
        workspace.createFileSystemWatcher(".build/*.yaml"),
      ],
    },
    initializationOptions: {
      isLSPServerTracingOn: config.isLSPTracingOn(), // used by sourcekites
      skProtocolProcess,
      skProtocolProcessAsShellCmd,
      skCompilerOptions: workspace.getConfiguration().get("sde.sourcekit.compilerOptions"),
      toolchainPath:
        workspace.getConfiguration("sourcekit-lsp").get<string>("toolchainPath") || null,
    },
    ...currentClientOptions(context),
  };

  // Create the language client and start the client.
  const lspOpts = currentServerOptions(context);
  const langClient = new LanguageClient("Swift", lspOpts, clientOptions);
  context.subscriptions.push(langClient.start());

  diagnosticCollection = languages.createDiagnosticCollection("swift");
  context.subscriptions.push(diagnosticCollection);

  //commands
  context.subscriptions.push(
    commands.registerCommand("sde.commands.buildPackage", buildSPMPackage),
    commands.registerCommand("sde.commands.restartLanguageServer", () => {
      output.build.log("sde.commands.restartLanguageServer");
    }),
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
  swiftPackageManifestPath = workspace.rootPath
    ? path.join(workspace.rootPath, "Package.swift")
    : null;
}

function currentServerOptions(context: ExtensionContext): ServerOptions {
  switch (config.lsp()) {
    case LangaugeServerMode.LanguageServer:
      return config.lspServerOptions(context);
    case LangaugeServerMode.SourceKit:
      return config.sourcekitLspServerOptions(context);
    case LangaugeServerMode.SourceKite:
      return config.sourcekiteServerOptions(context);
  }
}

function currentClientOptions(_context: ExtensionContext): Partial<LanguageClientOptions> {
  switch (config.lsp()) {
    case LangaugeServerMode.SourceKit:
      return {
        documentSelector: ["swift", "cpp", "c", "objective-c", "objective-cpp"],
        synchronize: undefined,
      };
    default:
      return {};
  }
}

function buildSPMPackage() {
  if (isSPMProject()) {
    statusBarItem.start();
    output.build.log("Starting package build");
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
