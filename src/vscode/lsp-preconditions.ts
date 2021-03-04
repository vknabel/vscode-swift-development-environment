import { commands, Uri, window, workspace } from "vscode";
import { absolutePath } from "../helpers/AbsolutePath";
import * as config from "./config-helpers";
import { LangaugeServerMode } from "./config-helpers";
import * as fs from "fs";

export async function currentLspPreconditions(): Promise<void> {
  await generalPreconditions();
  switch (config.lsp()) {
    case LangaugeServerMode.LanguageServer:
      return currentLanguageServerPreconditions();
    case LangaugeServerMode.SourceKit:
      return currentSourcekitLspPreconditions();
    case LangaugeServerMode.SourceKite:
      return currentSourcekitePreconditions();
  }
}

enum PreconditionActions {
  Retry = "Retry",
  OpenSettings = "Settings",
  InstructionsSourcekitLsp = "Help for sourcekit-lsp",
  InstructionsSourcekite = "Help for sourcekite",
  InstructionsLangserver = "Help for LangserverSwift",
}

async function generalPreconditions(): Promise<void> {
  const shellPath = absolutePath(workspace.getConfiguration().get("swift.path.shell"));
  if (!shellPath || !fs.existsSync(shellPath)) {
    await handlePreconditionAction(
      await window.showErrorMessage(
        `Wrong shell path ${shellPath} for setting swift.path.shell.`,
        PreconditionActions.Retry,
        PreconditionActions.OpenSettings
      )
    );
  }

  const swiftPath = absolutePath(workspace.getConfiguration().get("swift.path.swift_driver_bin"));
  if (!swiftPath || !fs.existsSync(swiftPath)) {
    await handlePreconditionAction(
      await window.showErrorMessage(
        `Swift not found at path ${swiftPath} for setting swift.path.swift_driver_bin`,
        PreconditionActions.Retry,
        PreconditionActions.OpenSettings
      )
    );
  }
}

async function currentLanguageServerPreconditions(): Promise<void> {
  const lspPath = config.languageServerPath();
  if (!fs.existsSync(lspPath)) {
    await handlePreconditionAction(
      await window.showErrorMessage(
        `Langserver not found at \`${lspPath}\`.
  Install it and provide the path to \`swift.languageServerPath\`.`,
        PreconditionActions.Retry,
        PreconditionActions.OpenSettings,
        PreconditionActions.InstructionsLangserver
      )
    );
  }
}

async function currentSourcekitLspPreconditions(): Promise<void> {
  const sourcekitLspPath = config.sourceKitLSPLocation(config.toolchainPath());

  if (!fs.existsSync(sourcekitLspPath)) {
    await handlePreconditionAction(
      await window.showErrorMessage(
        `sourcekit-lsp not found at \`${sourcekitLspPath}\`.
Install it and provide the path to \`sourcekit-lsp.serverPath\`.`,
        PreconditionActions.Retry,
        PreconditionActions.OpenSettings,
        PreconditionActions.InstructionsSourcekitLsp
      )
    );
  }
}

async function currentSourcekitePreconditions(): Promise<void> {
  const isDockerMode = workspace
    .getConfiguration()
    .get<boolean>("swift.path.sourcekiteDockerMode", false);
  const sourcekitePath = absolutePath(workspace.getConfiguration().get("swift.path.sourcekite"));

  if (!isDockerMode && !fs.existsSync(sourcekitePath)) {
    await handlePreconditionAction(
      await window.showErrorMessage(
        `\`sourcekite\` not found at \`${sourcekitePath}\`.
    Install it and provide the path to \`swift.path.sourcekite\`.`,
        PreconditionActions.Retry,
        PreconditionActions.OpenSettings,
        PreconditionActions.InstructionsSourcekite
      )
    );
  }
}

async function handlePreconditionAction(
  action: string | PreconditionActions | undefined
): Promise<void> {
  switch (action) {
    case PreconditionActions.Retry:
      await currentLspPreconditions();
      break;
    case PreconditionActions.OpenSettings:
      if (action === "Settings") {
        await commands.executeCommand("workbench.action.openSettings");
      }
      break;
    case PreconditionActions.InstructionsSourcekite:
      await commands.executeCommand(
        "vscode.open",
        Uri.parse(
          "https://github.com/vknabel/vscode-swift-development-environment/tree/2.11.1#using-sourcekit-lsp"
        )
      );
      break;
    case PreconditionActions.InstructionsSourcekitLsp:
      await commands.executeCommand(
        "vscode.open",
        Uri.parse(
          "https://github.com/vknabel/vscode-swift-development-environment/tree/2.11.1#using-sourcekite"
        )
      );
      break;
    case PreconditionActions.InstructionsLangserver:
      await commands.executeCommand(
        "vscode.open",
        Uri.parse(
          "https://github.com/vknabel/vscode-swift-development-environment/tree/2.11.1#using-langserver-swift"
        )
      );
      break;
  }
}
