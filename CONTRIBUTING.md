# Contributing
First of all: thank you for your interest in contributing to this project and open source in general.

In order to display autocompletions to users, this project actually consists of several parts:
* The user-facing Visual Studio Code extension SDE. It contributes commands, settings and keyboard shortcuts. It will compile your swift code. This part is written in Typescript and is located at [src/](./src).
* The SDE Language Server serves requests of your VS Code using the [Language Server Protocol](https://langserver.org/). It‘s job is to translate LSP requests to SourceKit (which powers Xcode) requests and to transform SourceKit‘s responses back to a valid LSP response. It communicates with SourceKit using Sourcekite. The language server is written in Typescript and is located at [src/server](./src/server).
* The last part is Sourcekite. It’s only purpose is to link against SourceKit and to provide a command line interface. It is written in Swift and located at [vknabel/sourcekite](https://github.com/vknabel/sourcekite).

There are many ways you could contribute to this project:
* Opening issues: most contributions start with an issue. Bug reports and feature requests are always welcome. If you have problems using this extension, just open an issue and we can improve the documentation together.
* We don’t know everything and you don’t have to in order to help others. You can read through some issues. You will probably be able to help others that way.
* If you want to get your hands dirty, you could try finding a starter issue. Though most parts are written in Typescript.
* Improve the ecosystem. If you want to get your hands dirty writing Swift code there is another [Language Server](https://github.com/RLovelett/langserver-swift) written in Swift! If you know Typescript, why not creating a new plugin? Ideas can be found on [vknabel/All-in-One-Swift-for-vscode](https://github.com/vknabel/All-in-One-Swift-for-vscode). Additionally [Apple announced](https://forums.swift.org/t/new-lsp-language-service-supporting-swift-and-c-family-languages-for-any-editor-and-platform/17024) to provide an official implementation in the future.