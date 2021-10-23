"use strict";

import { commands, DiagnosticCollection, ExtensionContext, Uri, window, workspace } from "vscode";
import { absolutePath } from "./helpers/AbsolutePath";
import * as tools from "./toolchain/SwiftTools";
import lsp from "./vscode/lsp-interop";
import output from "./vscode/output-channels";

let swiftBinPath: string | null = null;
let swiftBuildParams: string[] = ["build"];
export let diagnosticCollection: DiagnosticCollection;

let mostRecentRunTarget = "";

export async function activate(context: ExtensionContext) {
  output.init(context);

  if (workspace.getConfiguration().get<boolean>("sde.enable") === false) {
    output.build.log("SDE Disabled", false);
    return;
  }
  tools.setRunning(false);
  output.build.log("Activating SDE");

  initConfig();
  await lsp.startLSPClient(context);

  //commands
  let toolchain = new tools.Toolchain(
    swiftBinPath,
    workspace.workspaceFolders && workspace.workspaceFolders[0]
      ? workspace.workspaceFolders[0].uri.fsPath
      : "/",
    swiftBuildParams
  );
  context.subscriptions.push(toolchain.diagnostics);
  context.subscriptions.push(toolchain.start());
  context.subscriptions.push(
    commands.registerCommand("sde.commands.build", () => toolchain.build()),
    commands.registerCommand(
      "sde.commands.restartLanguageServer",
      async () => await lsp.restartLSPClient(context)
    ),
    commands.registerCommand("sde.commands.run", () => toolchain.runStart()),
    commands.registerCommand("sde.commands.selectRun", () => {
      window
        .showInputBox({ prompt: "Run which target?", value: mostRecentRunTarget })
        .then((target) => {
          if (!target) {
            return;
          }
          mostRecentRunTarget = target;
          toolchain.runStart(target);
        });
    }),
    commands.registerCommand("sde.commands.restart", () => {
      toolchain.runStop();
      toolchain.runStart(mostRecentRunTarget);
    }),
    commands.registerCommand("sde.commands.stop", () => toolchain.runStop()),
    commands.registerCommand("sde.commands.clean", () => toolchain.clean())
  );

  workspace.onDidSaveTextDocument(
    (document) => {
      if (tools.shouldBuildOnSave() && document.languageId === "swift") {
        toolchain.build();
      }
    },
    null,
    context.subscriptions
  );

  // respond to settings changes
  workspace.onDidChangeConfiguration(async (event) => {
    if (
      event.affectsConfiguration("sde") ||
      event.affectsConfiguration("swift") ||
      event.affectsConfiguration("sourcekit-lsp")
    ) {
      await lsp.restartLSPClient(context);
    }
  });

  // build on startup
  toolchain.build();
}

function initConfig() {
  swiftBinPath = absolutePath(workspace.getConfiguration().get("swift.path.swift_driver_bin"));
  swiftBuildParams = <string[]>workspace.getConfiguration().get("sde.swiftBuildingParams") || [
    "build",
  ];
}
