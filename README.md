# Swift Development Environment

[![Build Status](https://travis-ci.org/vknabel/swift-development-environment.svg?branch=master)](https://travis-ci.org/vknabel/swift-development-environment) ![Visual Studio Code Version](https://img.shields.io/badge/Visual%20Studio%20Code-1.17.0-6193DF.svg) ![Swift Version](https://img.shields.io/badge/Swift-3.1.0–5-orange.svg) [![SwiftPM compatible](https://img.shields.io/badge/SwiftPM-compatible-brightgreen.svg)](https://github.com/apple/swift-package-manager) ![Platforms](https://img.shields.io/badge/Platform-Linux|macOS-lightgrey.svg) ![License Apache](https://img.shields.io/badge/License-Apache%20v2-lightgrey.svg)

**SDE** adds Swift code completion and hover help to Visual Studio Code on macOS and Linux.

If possible, always favor [SSWG Swift VS Code extension](https://github.com/swift-server/vscode-swift) over this one. This will only receive maintenance updates, but no new features or other improvements.

> **Fork Notice:** This is the new home of SDE initially been developed by [@jinmingjian](https://github.com/jinmingjian). It is now maintained by [@vknabel](https://github.com/vknabel). [jinmingjian/sde](https://github.com/jinmingjian/sde) is no longer maintained and does only support Swift 3. This fork supports Swift 3.1, 4 and 5.

![preview](docs/preview.gif)

## Installation

You have the choice between three different language server implementations.

| `sde.languageServerMode`  | Comments                                  | Swift Versions                 | Install                                            |
| ------------------------- | ----------------------------------------- | ------------------------------ | -------------------------------------------------- |
| `sourcekit-lsp` _default_ | Apple's official one. Activley developed. | 4 and 5                        | [#Using sourcekit-lsp](#Using-sourcekit-lsp)       |
| `sourcekite`              | SDE's one. Actively maintained.           | 5 and older versions 3.1 and 4 | [#Using sourcekite](#Using-sourcekite)             |
| `langserver`              | RLovelett's LSP. Not maintained.          | 4.1, macOS only                | [#Using Langserver Swift](#Using-Langserver-Swift) |

sourcekit-lsp is easier to install and will be updated more frequently. On the other hand sourcekite treats standalone files, Xcode projects and SwiftPM modules differently and is more configurable. If you can't decide, you can install both and swap out the used LSP by setting `sde.languageServerMode` to `sourcekite`, `sourcekit-lsp` or `langserver`.

### Using sourcekit-lsp

> **Note:** on macOS SDE defaults to using your Xcode's Swift and sourcekit-lsp. In that case, [SDE](https://marketplace.visualstudio.com/items?itemName=vknabel.vscode-swift-development-environment) should work out of the box!

1. Install [SDE](https://marketplace.visualstudio.com/items?itemName=vknabel.vscode-swift-development-environment).
2. Recent versions of Xcode ship with `sourcekit-lsp`, you can check its path running `xcrun -f sourcekit-lsp`. If not found, please [install sourcekit-lsp](https://github.com/apple/sourcekit-lsp#building-sourcekit-lsp).
3. Set `"sourcekit-lsp.serverPath": "absolute path to the sourcekit-lsp executable"` and `"sde.languageServerMode": "sourcekit-lsp"`.

### Using sourcekite

1. sourcekite does only work with [SDE](https://marketplace.visualstudio.com/items?itemName=vknabel.vscode-swift-development-environment). Make sure you have it installed.
2. Install the companion project [sourcekite](https://github.com/vknabel/sourcekite).

   ```bash
   $ git clone https://github.com/vknabel/sourcekite
   $ cd sourcekite

   # For Linux
   # Ensure you have libcurl4-openssl-dev installed (not pre-installed)
   # $ apt-get update && apt-get install libcurl4-openssl-dev
   # Ensure LD_LIBRARY_PATH contains /your/swift/usr/lib
   # And have $ sudo ln -s /your/swift/usr/lib/libsourcekitdInProc.so /usr/lib/libsourcekitdInProc.so
   $ make install PREFIX=/usr/local

   # For macOS
   $ make install PREFIX=/usr/local
   ```

3. Add the _absolute_ path to your compiled sourcekite binary `swift.path.sourcekite` to your vscode settings as `/usr/local/sourcekite`.

If you experience any problems during installation, file an issue. All kind of feedback helps especially when trying to automate this.

### Using Langserver Swift

Besides sourcekit-lsp and sourcekite SDE allows you to use [RLovelett/langserver-swift](https://github.com/RLovelett/langserver-swift).

If you prefer using an alternative language server, set set `sde.languageServerMode` to `langserver` and let `swift.languageServerPath` point to your installed language server.

Though in most cases sourcekit-lsp and sourcekite should produce better results and performance.

## Configuration

| Config                             | Type       | Default                           | Description                                                                                                                                                                |
| ---------------------------------- | ---------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sourcekit-lsp.serverPath`         | `string`   |                                   | The path of the sourcekit-lsp executable. In SDE: defaults to the toolchain's sourcekit-lsp.                                                                               |
| `sourcekit-lsp.toolchainPath`      | `string`   |                                   | The path of the swift toolchain. In SDE: defaults to Xcode's default toolchain.                                                                                            |
| `swift.languageServerPath`         | `string`   | `/usr/local/bin/langserver-swift` | [DEPRECATED] The fully qualified path to the Swift Language Server executable.                                                                                             |
| `swift.path.sourcekite`            | `string`   |                                   | The fully path to the sourcekite(SDE's LS backend).                                                                                                                        |
| `swift.path.swift_driver_bin`      | `string`   | `/usr/bin/swift`                  | The fully path to the swift driver binary.                                                                                                                                 |
| `swift.path.shell`                 | `string`   | `/bin/sh`                         | The fully path to the shell binary.                                                                                                                                        |
| `sde.sourcekit.compilerOptions`    | `string[]` | `[]`                              | Optional compiler options like the target or search paths. Will only be used as default. `(debug \| release).yaml` builds will override these settings.                    |
| `swift.targets`                    | `object[]` | `[]`                              | If SDE cannot reliably detect all targets, you can manually configure them.                                                                                                |
| `sde.enable`                       | `boolean`  | `true`                            | Enable SDE functionality                                                                                                                                                   |
| `sde.languageServerMode`           | `string`   | `sourcekite`                      | Decides which language server should be used. `sourcekite` is the default LSP for SDE, `sourcekit-lsp` is Apple's official one and `langserver` is RLovelett's Langserver. |
| `sde.enableTracing.client`         | `boolean`  | `false`                           | Enable tracing output for SDE client                                                                                                                                       |
| `sde.enableTracing.LSPServer`      | `boolean`  | `false`                           | Enable tracing output for SDE LS server                                                                                                                                    |
| `sde.buildOnSave`                  | `boolean`  | `true`                            | Indicates wether SDE shall build the project on save.                                                                                                                      |
| `sde.swiftBuildingParams`          | `string[]` | `["build"]`                       | The params that shall be passed to the swift command.                                                                                                                      |
| `swift.diagnosis.max_num_problems` | `number`   | `100`                             | Controls the maximum number of problems produced by the server. NOET: Not used now.                                                                                        |

## Commands

| Title                   | Command                              |
| ----------------------- | ------------------------------------ |
| Build Package           | `sde.commands.build`                 |
| Restart Language Server | `sde.commands.restartLanguageServer` |
| Run Default Target      | `sde.commands.run`                   |
| Run Target…             | `sde.commands.selectRun`             |
| Restart Target          | `sde.commands.restartRun`            |
| Stop Running Target     | `sde.commands.stop`                  |
| Clean Package           | `sde.commands.clean`                 |

## Contributors

- Valentin Knabel, [@vknabel](https://github.com/vknabel), [twitter](https://twitter.com/vknabel), _maintainer_
- Clay Jensen-Reimann, [@clayreimann](https://github.com/clayreimann), [twitter](https://twitter.com/clayreimann)
- Jin Mingjian, [@JinMingjian](https://github.com/JinMingjian), [twitter](https://twitter.com/JinMingjian), _author_, not involved anymore
- Felix Fischer, [@felix91gr](https://github.com/felix91gr), [twitter](https://twitter.com/FelixFischer91)
- Mijo Gračanin, [@mijo-gracanin](https://github.com/mijo-gracanin)

## FAQ

### How to contribute to this project?

There are a lot of ways you could contribute to either this project or the Swift on VS Code itself. For more information head over to [CONTRIBUTING.md](./CONTRIBUTING.md).

### How can I debug my SwiftPM project?

Debugging your Swift targets requires a different extension [LLDB Debugger](https://github.com/vadimcn/vscode-lldb). You can follow this tutorial: [vknabel.com/pages/Debugging-Swift-in-VS-Code](https://www.vknabel.com/pages/Debugging-Swift-in-VS-Code/).

### How do I get autocompletion when using TensorFlow?

You can add the following configs. This will improve your autocompletion. Though currently the `TensorFlow` module will not be indexed yet.

```json
// .vscode/settings.json example for TensorFlow
{
  "sde.swiftBuildingParams": ["build", "-Xlinker", "-ltensorflow"],
  "sde.languageServerMode": "sourcekite",
  "sourcekit-lsp.toolchainPath": "/Library/Developer/Toolchains/swift-tensorflow-RELEASE-0.3.1.xctoolchain",
  "swift.path.swift_driver_bin": "/Library/Developer/Toolchains/swift-tensorflow-RELEASE-0.3.1.xctoolchain/usr/bin/swift"
}
```

> In case you find a way to get autocompletion for the `TensorFlow` module to work, please submit a PR or open an issue.

### How do I get autocompletion for UIKit?

With sourcekite, you can add new autocompletion targets through your configuration.

```json
// .vscode/settings.json example for iOS and WatchOS
{
  "swift.targets": [
    {
      "name": "YourApp",
      "path": "YourApp/YourApp",
      "sources": ["**/*.swift"],
      "compilerArguments": [
        "-sdk",
        "/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk",
        "-target",
        "arm64-apple-ios11.0"
      ]
    },
    {
      "name": "YourWatchApp",
      "path": "YourApp/YourWatchExtension",
      "sources": ["**/*.swift"],
      "compilerArguments": [
        "-sdk",
        "/Applications/Xcode.app/Contents/Developer/Platforms/WatchOS.platform/Developer/SDKs/WatchOS.sdk",
        "-target",
        "armv7k-apple-watchos4.0"
      ]
    }
  ]
}
```

Since Xcode 11.4, you may use its built-in support for sourcekit-lsp

```json
// .vscode/settings.json example for iOS
{
  "sde.languageServerMode": "sourcekit-lsp",
  "sourcekit-lsp.serverPath": "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/sourcekit-lsp",
  "sourcekit-lsp.toolchainPath": "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain",
  "sde.swiftBuildingParams": [
    "build",
    "-Xswiftc",
    "-sdk",
    "-Xswiftc",
    "/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk",
    "-Xswiftc",
    "-target",
    "-Xswiftc",
    "arm64-apple-ios11.0"
  ]
}
```

```json
// .vscode/settings.json example for WatchOS
{
  "sde.languageServerMode": "sourcekit-lsp",
  "sourcekit-lsp.serverPath": "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/sourcekit-lsp",
  "sourcekit-lsp.toolchainPath": "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain",
  "sde.swiftBuildingParams": [
    "build",
    "-Xswiftc",
    "-sdk",
    "-Xswiftc",
    "/Applications/Xcode.app/Contents/Developer/Platforms/WatchOS.platform/Developer/SDKs/WatchOS.sdk",
    "-Xswiftc",
    "-target",
    "-Xswiftc",
    "armv7k-apple-watchos4.0"
  ]
}
```

### Build failed! What should I do?

Go to vscode `OUTPUT` window, then select `SPM`. The `OUTPUT` window will tell you what's wrong.

### It says `Build error: root manifest not found`??

The Root Manifest refers to a Package.swift file of the Swift Package Manager (short SwiftPM, SPM). And this extension requires a Swift Package (a project for the SwiftPM) to function. Projects created by Xcode rely on a different format (`*.xcodeproj` and `*.xcodeworkspace`) and the extension cannot handle these.

You'll need to create a new Swift Package and "wire it up" with your Xcode Project. There are some tips and guides linked in [this SO question](https://stackoverflow.com/questions/41900749/use-swift-package-manager-on-existing-xcode-project).

### I'd like to have a different build paths than usually. How can I achieve that?

You can compile your app using a command like `swift build --build-path "./.build-macos"` on macOS and `swift build --build-path "./.build-linux"` on Linux, e.g. from within a docker container, you just need to add the appropriate building parameter:

```
// .vscode/settings.json
{
  "sde.swiftBuildingParams": [
    "build",
    "--build-path",
    "./.build-macos"
  ]
}
```

### Other questions?

If so, file an [issue](https://github.com/vknabel/vscode-swift-development-environment/issues), please :)

## License

Apache License v2.

## 3rd-party Sources Thanks

1. [dbgmits](https://github.com/enlight/dbgmits), very nice structure of sources, but of which in my heavy modification to support non-MI and much more
