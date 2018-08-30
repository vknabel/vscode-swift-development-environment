import * as vscode from "vscode";

export class SwiftConfigurationProvider
  implements vscode.DebugConfigurationProvider {
  provideDebugConfigurations(
    _folder: vscode.WorkspaceFolder | undefined,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [
      {
        type: "swift-debug",
        request: "launch",
        name: "Swift Program Debug",
        program: "${workspaceRoot}/.build/debug/path-to-program-debugged"
      }
    ];
  }
}
