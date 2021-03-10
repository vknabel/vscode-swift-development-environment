import * as path from "path";
import * as fs from "fs";
import { workspace, ExtensionContext } from "vscode";
import { ServerOptions, TransportKind, Executable } from "vscode-languageclient";

export enum LangaugeServerMode {
  SourceKit = "sourcekit-lsp",
  LanguageServer = "langserver",
  SourceKite = "sourcekite",
}

/**
 * @returns which language server to use
 */
export function lsp(): LangaugeServerMode {
  return workspace
    .getConfiguration()
    .get<LangaugeServerMode>("sde.languageServerMode", LangaugeServerMode.SourceKit);
}

/**
 * @returns if the project should be built when a file is saved
 */
export function buildOnSave(): boolean {
  return workspace.getConfiguration().get<boolean>("sde.buildOnSave", true);
}

/**
 * @returns if build logging is enabled
 */
export function isBuildTracingOn(): boolean {
  return workspace.getConfiguration().get("sde.enableTracing.client");
}

export function isLSPTracingOn(): boolean {
  return workspace.getConfiguration().get("sde.enableTracing.LSPServer");
}

/**
 * get server options for
 * @param context the current extension context
 */
export function sourcekiteServerOptions(context: ExtensionContext): ServerOptions {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join("out/sourcekites-server", "server.js"));
  // The debug options for the server
  const debugOptions = {
    execArgv: ["--nolazy", "--inspect=6004"],
    ...process.env,
  };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  return serverOptions;
}

export function languageServerPath(): string {
  return workspace
    .getConfiguration("swift")
    .get("languageServerPath", "/usr/local/bin/LanguageServer");
}
export function lspServerOptions(): ServerOptions {
  // Load the path to the language server from settings
  const executableCommand = languageServerPath();

  const run: Executable = {
    command: executableCommand,
    options: process.env,
  };
  const debug: Executable = run;
  const serverOptions: ServerOptions = {
    run: run,
    debug: debug,
  };
  return serverOptions;
}

export function toolchainPath(): string {
  return workspace.getConfiguration("sourcekit-lsp").get<string>("toolchainPath");
}
export function sourcekitLspServerOptions(): ServerOptions {
  const toolchain = workspace.getConfiguration("sourcekit-lsp").get<string>("toolchainPath");

  const sourcekitPath = sourceKitLSPLocation(toolchain);

  // sourcekit-lsp takes -Xswiftc arguments like "swift build", but it doesn't need "build" argument
  const sourceKitArgs = workspace
    .getConfiguration()
    .get<string[]>("sde.swiftBuildingParams", [])
    .filter(param => param !== "build");

  const env: NodeJS.ProcessEnv = toolchain
    ? { ...process.env, SOURCEKIT_TOOLCHAIN_PATH: toolchain }
    : process.env;

  const run: Executable = {
    command: sourcekitPath,
    options: { env },
    args: sourceKitArgs,
  };
  const serverOptions: ServerOptions = run;
  return serverOptions;
}

export function sourceKitLSPLocation(toolchain: string | undefined): string {
  const explicit = workspace
    .getConfiguration("sourcekit-lsp")
    .get<string | null>("serverPath", null);
  if (explicit) return explicit;

  const sourcekitLSPPath = path.resolve(
    toolchain || "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain",
    "usr/bin/sourcekit-lsp"
  );
  const isPreinstalled = fs.existsSync(sourcekitLSPPath);
  if (isPreinstalled) {
    return sourcekitLSPPath;
  }

  return workspace
    .getConfiguration("swift")
    .get("languageServerPath", "/usr/local/bin/sourcekit-lsp");
}
