# Swift Development Environment

[![Build Status](https://travis-ci.org/vknabel/swift-development-environment.svg?branch=master)](https://travis-ci.org/vknabel/swift-development-environment) ![Visual Studio Code Version](https://img.shields.io/badge/Visual%20Studio%20Code-1.17.0-6193DF.svg) ![Swift Version](https://img.shields.io/badge/Swift-3.1.0–4.0-orange.svg) [![SwiftPM compatible](https://img.shields.io/badge/SwiftPM-compatible-brightgreen.svg)](https://github.com/apple/swift-package-manager) ![Platforms](https://img.shields.io/badge/Platform-Linux|macOS-lightgrey.svg) ![License Apache](https://img.shields.io/badge/License-Apache%20v2-lightgrey.svg)

**SDE** adds Swift code completion and hover help to Visual Studio Code on macOS and Linux.

> **Fork Notice:** This is the new home of SDE initially been developed by [@jinmingjian](https://github.com/jinmingjian). It is now maintained by [@vknabel](https://github.com/vknabel). [jinmingjian/sde](https://github.com/jinmingjian/sde) is no longer maintained and does only support Swift 3. This fork supports Swift 3.1, 4 and 5.

![preview](docs/preview.gif)

## Installation

You have the choice between three different language server implementations.

| `sde.languageServerMode` | Comments                                  | Swift Versions             | Install                                            |
| ------------------------ | ----------------------------------------- | -------------------------- | -------------------------------------------------- |
| `sourcekit-lsp`          | Apple's official one. Activley developed. | 4 and 5                    | [#Using sourcekite](#Using-sourcekite)             |
| `sourcekite` _default_   | SDE's one. Actively maintained.           | 4, 5 and older version 3.1 | [#Using sourcekit-lsp](#Using-sourcekit-lsp)       |
| `langserver`             | RLovelett's LSP. Not maintained.          | 4.1, macOS only            | [#Using Langserver Swift](#Using-Langserver-Swift) |

sourcekit-lsp is easier to install and will be updated more frequently. On the other hand sourcekite treats standalone files, Xcode projects and SwiftPM modules differently and is more configurable. If you can't decide, you can install both and swap out the used LSP by setting `sde.languageServerMode` to `sourcekite`, `sourcekit-lsp` or `langserver`.

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
   # And have $ sudo ln -s /your/swift/usr/lib/libsourcekitdInProc.so /usr/lib/sourcekitdInProc
   $ swift build -Xlinker -l:sourcekitdInProc -c release

   # For macOS (when using swiftenv or multiple Toolchains)
   $ make install LIB_DIR=/Library/Developer/Toolchains/swift-latest.xctoolchain/usr/lib

   # For macOS (using Xcode's Toolchain)
   $ make install LIB_DIR=/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib
   ```

3. Add the _absolute_ path to your compiled sourcekite binary `swift.path.sourcekite` to your vscode settings as `/path/to/your/sourcekite-bin/.build/release/sourcekite`.

If you experience any problems during installation, file an issue or write me an [email](mailto:dev@vknabel.com). All kind of feedback helps especially when trying to automate this.

### Using sourcekit-lsp

1. Install [SDE](https://marketplace.visualstudio.com/items?itemName=vknabel.vscode-swift-development-environment).
2. [Install sourcekite-lsp](https://github.com/apple/sourcekit-lsp#building-sourcekit-lsp).
3. Add the _absolute_ path to your compiled sourcekite binary `sourcekit-lsp.serverPath`, optionally to your toolchain `sourcekit-lsp.toolchainPath` and tell SDE to use sourcekit-lsp `"sde.languageServerMode": "sourcekit-lsp"`.

### Using Langserver Swift

Besides sourcekit-lsp and sourcekite SDE allows you to use [RLovelett/langserver-swift](https://github.com/RLovelett/langserver-swift).

If you prefer using an alternative language server, set set `sde.languageServerMode` to `langserver` and let `swift.languageServerPath` point to your installed language server.

Though in most cases sourcekit-lsp and sourcekite should produce better results and performance.

## Debugging

SDE has a built-in Swift debugger which has been deprecated. Instead use [LLDB Debugger](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) which powers more features and is more stable.

Below is an example configuration supporting running executable targets, unit tests on macOS and Linux.
Relevant files will be compiled using the pre-launch-tasks.

```js
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        // Running executables
        {
            "type": "lldb",
            "request": "launch",
            "name": "Run your Executable",
            "program": "${workspaceFolder}/.build/debug/your-executable",
            "args": [],
            "cwd": "${workspaceFolder}",
            "preLaunchTask": "swift-build"
        },
        // Running unit tests
        {
            "type": "lldb",
            "request": "launch",
            "name": "Debug tests on macOS",
            "program": "<path to xctest executable>", //For example /Applications/Xcode.app/Contents/Developer/usr/bin/xctest
            "args": [
                "${workspaceFolder}.build/debug/<xctest bundle name>.xctest"
            ],
            "preLaunchTask": "swift-build-tests"
        },
        {
            "type": "lldb",
            "request": "launch",
            "name": "Debug tests on Linux",
            "program": "./.build/x86_64-unknown-linux/debug/YourPackageTests.xctest",
            "preLaunchTask": "swift-build-tests"
        }
    ]
}
```

```js
// .vscode/tasks.json
{
    "version": "2.0.0",
    "tasks": [
        // compile your SPM project
        {
            "label": "swift-build",
            "type": "shell",
            "command": "swift build"
        },
        // compile your SPM tests
        {
            "label": "swift-build-tests",
            "type": "process",
            "command": "swift",
            "group": "build",
            "args": [
                "build",
                "--build-tests"
            ]
        }
}
```

## Contributors

- Valentin Knabel, [@vknabel](https://github.com/vknabel), [twitter](https://twitter.com/vknabel), _maintainer_
- Jin Mingjian, [@JinMingjian](https://github.com/JinMingjian), [twitter](https://twitter.com/JinMingjian), _author_
- Felix Fischer, [@felix91gr](https://github.com/felix91gr), [twitter](https://twitter.com/FelixFischer91)
- Mijo Gračanin, [@mijo-gracanin](https://github.com/mijo-gracanin)

## FAQ

### How to contribute to this project?

There are a lot of ways you could contribute to either this project or the Swift on VS Code itself. For more information head over to [CONTRIBUTING.md](./CONTRIBUTING.md).

### How do I get autocompletion for UIKit?

You can add new autocomplation targets through your configuration.

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

### Other questions?

If so, file an [issue](https://github.com/vknabel/swift-development-environment/issues), please :)

## License

Apache License v2.

## 3rd-party Sources Thanks

1. [dbgmits](https://github.com/enlight/dbgmits), very nice structure of sources, but of which in my heavy modification to support non-MI and much more
