# Swift Development Environment

[![Build Status](https://travis-ci.org/vknabel/swift-development-environment.svg?branch=master)](https://travis-ci.org/vknabel/swift-development-environment) ![Visual Studio Code Version](https://img.shields.io/badge/Visual%20Studio%20Code-1.17.0-6193DF.svg) ![Swift Version](https://img.shields.io/badge/Swift-3.1.0–4.0-orange.svg) [![SwiftPM compatible](https://img.shields.io/badge/SwiftPM-compatible-brightgreen.svg)](https://github.com/apple/swift-package-manager) ![Platforms](https://img.shields.io/badge/Platform-Linux|macOS-lightgrey.svg) ![License Apache](https://img.shields.io/badge/License-Apache%20v2-lightgrey.svg)

**SDE** adds Swift code completion and hover help to Visual Studio Code on macOS and Linux.

> **Fork Notice:** This is the new home of SDE initially been developed by [@jinmingjian](https://github.com/jinmingjian). It is now maintained by [@vknabel](https://github.com/vknabel). [jinmingjian/sde](https://github.com/jinmingjian/sde) is no longer maintained and does only support Swift 3. This fork supports Swift 3 and 4.

![preview](docs/preview.gif)

## Installation
1. Install the [extension](https://marketplace.visualstudio.com/items?itemName=vknabel.vscode-swift-development-environment) itself.
2. Install the companion project [sourcekite](https://github.com/vknabel/sourcekite).

	```bash
	$ git clone https://github.com/vknabel/sourcekite
	$ cd sourcekite

	# For Linux
    # Ensure LD_LIBRARY_PATH contains /your/swift/usr/lib
    # And have ln -s /usr/lib/sourcekitdInProc /your/swift/usr/lib/libsourcekitdInProc.so
	$ swift build -Xlinker -l:sourcekitdInProc -c release

	# For macOS (when using swiftenv or multiple Toolchains)
	$ swift build -Xswiftc -framework -Xswiftc sourcekitd -Xswiftc -F -Xswiftc /Library/Developer/Toolchains/swift-latest.xctoolchain/usr/lib -Xlinker -rpath -Xlinker /Library/Developer/Toolchains/swift-latest.xctoolchain/usr/lib -c release

	# For macOS (using Xcode's Toolchain)
	$ swift build -Xswiftc -framework -Xswiftc sourcekitd -Xswiftc -F -Xswiftc /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/ -Xlinker -rpath -Xlinker /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/ -c release
	```
3. Add the *absolute* path to your compiled sourcekite binary `swift.path.sourcekite` to your vscode settings as `/path/to/your/sourcekite-bin/.build/release/sourcekite`.

If you experience any problems during installation, file an issue or write me an [email](mailto:dev@vknabel.com). All kind of feedback helps especially when trying to automate this.

## Debugging

SDE has a built-in Swift debugger which has been deprecated. Instead use [LLDB Debugger](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) which powers more features and is more stable.

An example config can be seen below. `program` should contain the path to your built executable, the `preLaunchTask` is optional, but will run `swift build` before each debug session to keep your binaries up to date.

> **Note:** Currently I don't know of any reliable solution to debug your Swift tests.
> If you do, please file an issue or write me an [email](mailto:dev@vknabel.com).

```js
// .vscode.json/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "lldb",
            "request": "launch",
            "name": "Run your Executable",
            "program": "${workspaceFolder}/.build/debug/your-executable",
            "args": [],
            "cwd": "${workspaceFolder}",
            "preLaunchTask": "swift-build"
        }
}
```

```js
// .vscode.json/tasks.json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "swift-build",
            "type": "shell",
            "command": "swift build"
        }
}
```

## Contributors
- Valentin Knabel, [@vknabel](https://github.com/vknabel), [twitter](https://twitter.com/vknabel), *maintainer*
- Jin Mingjian, [@JinMingjian](https://github.com/JinMingjian), [twitter](https://twitter.com/JinMingjian), *author*
- Felix Fischer, [@felix91gr](https://github.com/felix91gr), [twitter](https://twitter.com/FelixFischer91)

## FAQ

### How to contribute to this project?

Any feedback helps.

If you mean contributions to the **sources**, this is truely another topic. The experience of **_using_** an editor is much different than that of **_developing_** one. It might be a bit more painful than you think. But if you would like to, welcome!

There aren't too much documents about the development of this project. If you have any questions or interests, don't hesitate to file an [issue](https://github.com/vknabel/swift-development-environment/issues) or write me an [email](mailto:dev@vknabel.com). I will help you and then drop more readings as time goes by. This is **_the way of "open source"_**.

### How do I get autocompletion for UIKit?

Just add `"sde.sourcekit.compilerOptions": ["-target", "arm64-apple-ios11.0"]` to your workspace settings in Visual Studio Code and restart it.

### Other questions?

If so, file an [issue](https://github.com/vknabel/swift-development-environment/issues), please :)

## License
Apache License v2.

## 3rd-party Sources Thanks
1. [dbgmits](https://github.com/enlight/dbgmits), very nice structure of sources, but of which in my heavy modification to support non-MI and much more
