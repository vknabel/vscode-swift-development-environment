# Changelog

## 2.4.0
* Bumped internal dependencies to be more reliable on newer vscode versions
* New setting `sde.swiftBuildingParams` allows run other commands than `swift build` #24 jinmingjian/sde#32

### Building Params
It is now possible to run different commands when building swift code.
* `"sde.swiftBuildingParams": ["build"]`: default setting
* `"sde.swiftBuildingParams": ["build", "--build-path", ".vscode-build"]`: build in different directory, see #24
* `"sde.swiftBuildingParams": ["build", "--build-tests"]`: compile tests, but do not run them
* `"sde.swiftBuildingParams": ["test"]`: runs unit tests jinmingjian/sde#32

## 2.3.2
* Code format did fail #19
* Code format always indented by 4 spaces. Now configurable.

### Tabwidth
By default `editor.tabSize` will be used. As this setting is global and affects all code, you can optionally override it using `"[swift]": { "tabSize": 2 }`.

## 2.3.1
* Accidentially logged SourceKit's `key.kind` and `key.description`
* Removed unused config `editor.quickSuggestions`
* Will no longer write `sde.buildOnSave` or `editor.quickSuggestions` to workspace settings
* `#` will now trigger completions
* `-target` will now be detected for `UIKit`, `AppKit`, `WatchKit` and `Foundation` on macOS and linux #15
* Index all swift files together when no `Package.swift` defined #14

## 2.3.0
* Fixes autocompletion for methods and invocations leading to invalid syntax #9
* Fixes a bug thats lead the extension to stop working #10
* Display documentation on Hover #11

## 2.2.0
* Autocompletion for external libraries like AppKit and UIKit after restart #8
* Display short documentation on autocompletion
* More reliable autocompletion, especially for global namespace
* New `"sde.sourcekit.compilerOptions"` setting

### How do I get autocompletion for UIKit?

Just add `"sde.sourcekit.compilerOptions": ["-target", "arm64-apple-ios11.0"]` to your workspace settings in Visual Studio Code and restart it.


## 2.1.3
* Improved new README
* Deprecated debugger, use [LLDB Debugger](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) instead

An example config of using LLDB Debugger can be seen below. `program` should contain the path to your built executable as before, the `preLaunchTask` is optional, but will run `swift build` before each debug session to keep your binaries up to date.

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

## 2.1.2

## 2.1.1
* Did not work with latest vscode #2 and #3

## 2.1.0
* Initial Swift 4 support jinmingjian/sde#38.

## 2.0.20170209
* make a sourcekite docker image and add a new experimental setting "swift.path.sourcekiteDockerMode" for easier adoption for Linux users (issue: #26) (MacOS users do not need to update to this version in that there is no other additions in this version)

## 2.0.20170206
* release 2.0 ships a Swift language server backend and a new simple, async, pipe driven language server frontend (issue: #9). This new backend solves the unicode problem of original tool sourcekit-repl. This new frontend improves the code logic and the performance which leave the room for future messaging optimization when needed as well. Futhermore, it is not needed to build whole things from Swift's sources any more.

### 2.0 Release Broadcast
The `2.0` release introduces a new tool, [SourceKite](https://github.com/jinmingjian/sourcekite), as the interface to **SourceKit** library. Since the Swift `ABI` is not stable, you need to build it if you want to use SDE. Go to [SourceKite](https://github.com/jinmingjian/sourcekite) for further instructions.

Also because the Swift ABI **is not stable**, you may find that the _Hover Help_ or the _Code Completion_ don't display the right information after you upgrade your Swift toolchain. This is because the SourceKit library you linked with the [SourceKite](https://github.com/jinmingjian/sourcekite) tool can't understand the sources or binaries of your project. To fix this, **rebuild your project** and **restart vscode**.

#### Want to downgrade?
If the release broke your current experience or if you accidentally upgraded, you can go back to the previous releases like this:

1. Download the 1.x vsix from [the release page](https://github.com/vknabel/swift-development-environment/releases)
2. Remove the installed version in your vscode
3. Install the local `.vsix` package in your vscode

## 1.0.20170129
* serveral fixs for release 1.x and we want to release great new 2.0

## 1.0.20170118
* experimental built-in sourcekit interface (only for macOS)

## 1.0.20170114
* add an config option for shell exec path (issue: #15)

## 1.0.20170113
* fix hard-coded shell exec path for macOS (issue: #14)

## 1.0.20170112
* add container type info in hover (issue: #6)

## 1.0
* Initial public release.

You can read a [hands-on introduction](http://blog.dirac.io/2017/01/11/get_started_sde.html) for a detailed explanation.
