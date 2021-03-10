import { workspace, ExtensionContext, Disposable } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient";
import { absolutePath } from "../helpers/AbsolutePath";
import * as config from "./config-helpers";
import { LangaugeServerMode } from "./config-helpers";
import { currentLspPreconditions } from "./lsp-preconditions";

function currentServerOptions(context: ExtensionContext): ServerOptions {
  switch (config.lsp()) {
    case LangaugeServerMode.LanguageServer:
      return config.lspServerOptions();
    case LangaugeServerMode.SourceKit:
      return config.sourcekitLspServerOptions();
    case LangaugeServerMode.SourceKite:
      return config.sourcekiteServerOptions(context);
  }
}

function currentClientOptions(): Partial<LanguageClientOptions> {
  switch (config.lsp()) {
    case LangaugeServerMode.SourceKit:
      return {
        documentSelector: ["swift", "objective-c", "objective-cpp"],
        synchronize: undefined,
      };
    case LangaugeServerMode.SourceKite:
      return {
        initializationOptions: {
          isLSPServerTracingOn: config.isLSPTracingOn(),
          skProtocolProcess: absolutePath(
            workspace.getConfiguration().get("swift.path.sourcekite")
          ),
          skProtocolProcessAsShellCmd: workspace
            .getConfiguration()
            .get<boolean>("swift.path.sourcekiteDockerMode"),
          skCompilerOptions: workspace.getConfiguration().get("sde.sourcekit.compilerOptions"),
          toolchainPath:
            workspace.getConfiguration("sourcekit-lsp").get<string>("toolchainPath") || null,
        },
      };
    default:
      return {};
  }
}

let lspClient: LanguageClient | undefined;
let clientDisposable: Disposable | undefined;

/**
 * Starts the LSP client (which specifies how to start the LSP server), and registers
 * a dispoasble in the extension context.
 * @param context the SDE extension context
 */
async function startLSPClient(context: ExtensionContext) {
  await currentLspPreconditions();
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documentss
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
    ...currentClientOptions(),
  };
  // Create the language client and start the client.
  const lspOpts = currentServerOptions(context);
  lspClient = new LanguageClient("Swift", lspOpts, clientOptions);
  clientDisposable = lspClient.start();
  context.subscriptions.push(clientDisposable);
}

/**
 * Stops the current LSP client and starts a new client.
 * The client is stopped using the disposable returned from `client.start()`
 * @param context the SDE extension context
 */
async function restartLSPClient(context: ExtensionContext) {
  clientDisposable.dispose();
  await startLSPClient(context);
}

export default {
  startLSPClient,
  restartLSPClient,
};
