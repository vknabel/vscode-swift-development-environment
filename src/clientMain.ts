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
  StatusBarItem,
  StatusBarAlignment,
  OutputChannel,
  TextDocument,
  ThemeColor,
} from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient";
import { absolutePath } from "./AbsolutePath";

import {
  buildOnSave,
  sourcekiteServerOptions,
  lspServerOptions,
  sourcekitLspServerOptions,
} from "./config-helpers";

let swiftBinPath: string | null = null;
let swiftBuildParams: string[] = ["build"];
let swiftPackageManifestPath: string | null = null;
let skProtocolProcess: string | null = null;
let skProtocolProcessAsShellCmd: string | null = null;
export let isTracingOn: boolean = false;
export let isLSPServerTracingOn: boolean = false;
export let diagnosticCollection: DiagnosticCollection;
let spmChannel: OutputChannel | null = null;

export async function activate(context: ExtensionContext) {
  if (workspace.getConfiguration().get<boolean>("sde.enable") === false) {
    return;
  }
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
      isLSPServerTracingOn,
      skProtocolProcess,
      skProtocolProcessAsShellCmd,
      skCompilerOptions: workspace.getConfiguration().get("sde.sourcekit.compilerOptions"),
      toolchainPath:
        workspace.getConfiguration("sourcekit-lsp").get<string>("toolchainPath") || null,
    },
    ...currentClientOptions(context),
  };

  // Create the language client and start the client.
  const lspOpts = await currentServerOptions(context);
  const langClient = new LanguageClient("Swift", lspOpts, clientOptions);
  context.subscriptions.push(langClient.start());

  diagnosticCollection = languages.createDiagnosticCollection("swift");
  context.subscriptions.push(diagnosticCollection);

  //commands
  context.subscriptions.push(
    commands.registerCommand("sde.commands.buildPackage", buildSPMPackage)
  );

  workspace.onDidSaveTextDocument(onSave, null, context.subscriptions);

  // build on startup
  buildSPMPackage();
}

function initConfig() {
  checkToolsAvailability();

  isTracingOn = <boolean>workspace.getConfiguration().get("sde.enableTracing.client");
  isLSPServerTracingOn = <boolean>workspace.getConfiguration().get("sde.enableTracing.LSPServer");
  //FIXME rootPath may be undefined for adhoc file editing mode???
  swiftPackageManifestPath = workspace.rootPath
    ? path.join(workspace.rootPath, "Package.swift")
    : null;

  spmChannel = window.createOutputChannel("SPM");
}

function currentServerOptions(context: ExtensionContext): ServerOptions {
  const lspMode = workspace.getConfiguration("sde").get("languageServerMode", "sourcekit-lsp");

  if (lspMode === "sourcekit-lsp") {
    return sourcekitLspServerOptions(context);
  } else if (lspMode === "langserver") {
    return lspServerOptions(context);
  } else {
    return sourcekiteServerOptions(context);
  }
}

function currentClientOptions(_context: ExtensionContext): Partial<LanguageClientOptions> {
  const lspMode = workspace.getConfiguration("sde").get("languageServerMode");
  if (lspMode === "sourcekit-lsp") {
    return {
      documentSelector: ["swift", "cpp", "c", "objective-c", "objective-cpp"],
      synchronize: undefined,
    };
  } else {
    return {};
  }
}

function buildSPMPackage() {
  if (isSPMProject()) {
    if (!buildStatusItem) {
      initBuildStatusItem();
    }

    makeBuildStatusStarted();
    tools.buildPackage(swiftBinPath, workspace.rootPath, swiftBuildParams);
  }
}

function onSave(document: TextDocument) {
  if (buildOnSave() && document.languageId === "swift") {
    buildSPMPackage();
  }
}

export let buildStatusItem: StatusBarItem;
let originalBuildStatusItemColor: string | ThemeColor | undefined = undefined;
function initBuildStatusItem() {
  buildStatusItem = window.createStatusBarItem(StatusBarAlignment.Left);
  originalBuildStatusItemColor = buildStatusItem.color;
}

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let building: NodeJS.Timeout | null = null;

function makeBuildStatusStarted() {
  buildStatusItem.color = originalBuildStatusItemColor;
  buildStatusItem.show();
  let animation = frame();
  if (building) {
    clearInterval(building);
  }
  building = setInterval(() => {
    buildStatusItem.text = `${animation()} building`;
  }, 100);
}

function frame() {
  var i = 0;
  return function() {
    return frames[(i = ++i % frames.length)];
  };
}

export function makeBuildStatusFailed() {
  if (building) {
    clearInterval(building);
  }
  buildStatusItem.text = "$(issue-opened) build failed";
  buildStatusItem.color = "red";
}

export function makeBuildStatusSuccessful() {
  if (building) {
    clearInterval(building);
  }
  buildStatusItem.text = "$(check) build succeeded";
  buildStatusItem.color = originalBuildStatusItemColor;
}

function isSPMProject(): boolean {
  return swiftPackageManifestPath ? fs.existsSync(swiftPackageManifestPath) : false;
}

export function trace(...msg: any[]) {
  if (isTracingOn) {
    console.log(...msg);
  }
}

export function dumpInConsole(msg: string) {
  spmChannel?.append(msg);
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
