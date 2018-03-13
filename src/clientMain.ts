'use strict';

import * as path from 'path'
import * as fs from 'fs'
import * as tools from './SwiftTools'
import * as os from 'os'
import {
	workspace, window, commands, languages, extensions,
	Disposable, ExtensionContext, Uri, DiagnosticCollection,
	StatusBarItem, StatusBarAlignment, OutputChannel, debug
} from 'vscode';
import {
	LanguageClient, LanguageClientOptions,
	SettingMonitor, ServerOptions, TransportKind
} from 'vscode-languageclient';
import { SwiftConfigurationProvider } from './SwiftConfigurationProvider';

const LENGTH_PKG_FILE_NAME: number = "Package.swift".length
const PUBLISHER_NAME = "jinmingjian.sde"

let swiftBinPath: string | null = null
let swiftPackageManifestPath: string | null = null
let skProtocolProcess: string | null = null
let skProtocolProcessAsShellCmd: string | null = null
export let isTracingOn: boolean = false
export let isLSPServerTracingOn: boolean = false
export let diagnosticCollection: DiagnosticCollection
let spmChannel: OutputChannel = null

export function activate(context: ExtensionContext) {
	//debug
	context.subscriptions.push(debug.registerDebugConfigurationProvider('swift', new SwiftConfigurationProvider()));

	initConfig()

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('out/src/server', 'server.js'));
	// The debug options for the server
	let debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	}

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: ['swift'],
		synchronize: {
			configurationSection: 'swift',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/*.swift')
		},
		initializationOptions: {
			'isLSPServerTracingOn': isLSPServerTracingOn,
			'skProtocolProcess': skProtocolProcess,
			'skProtocolProcessAsShellCmd': skProtocolProcessAsShellCmd,
			'skCompilerOptions': workspace.getConfiguration().get('sde.sourcekit.compilerOptions')
		},
	}

	// console.log(workspace.getConfiguration().get('editor.quickSuggestions'))
	// Create the language client and start the client.
	let disposable = new LanguageClient('Swift', serverOptions, clientOptions).start()

	context.subscriptions.push(disposable)
	diagnosticCollection = languages.createDiagnosticCollection('swift');
	context.subscriptions.push(diagnosticCollection);


	function buildSPMPackage() {
		if (isSPMProject()) {
			//setup
			if (!buildStatusItem) {
				initBuildStatusItem()
			}

			makeBuildStatusStarted()
			tools.buildPackage(
				swiftBinPath,
				workspace.rootPath,
				null)
		}
	}
	//commands
	context.subscriptions.push(
		commands.registerCommand('sde.commands.buildPackage', buildSPMPackage)
	);
	// build on save
	workspace.onDidSaveTextDocument(
		document => {
			if (document.languageId === 'swift') {
				buildSPMPackage()
			}
		},
		null,
		context.subscriptions
	);

	// build on startup
	buildSPMPackage();
}

function initConfig() {
	checkToolsAvailability()

	workspace.getConfiguration().update('editor.quickSuggestions', false, false)
	workspace.getConfiguration().update('sde.buildOnSave', true, false)

	isTracingOn = <boolean>workspace.getConfiguration().get('sde.enableTracing.client')
	isLSPServerTracingOn = <boolean>workspace.getConfiguration().get('sde.enableTracing.LSPServer')
	//FIXME rootPath may be undefined for adhoc file editing mode???
	swiftPackageManifestPath = path.join(workspace.rootPath, "Package.swift");

	spmChannel = window.createOutputChannel("SPM")
}

export let buildStatusItem: StatusBarItem
let originalBuildStatusItemColor = null
function initBuildStatusItem() {
	buildStatusItem = window.createStatusBarItem(StatusBarAlignment.Left);
	originalBuildStatusItemColor = buildStatusItem.color
}

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
let building: NodeJS.Timer | null = null

function makeBuildStatusStarted() {
	buildStatusItem.color = originalBuildStatusItemColor
	buildStatusItem.show()
	let animation = frame()
	if (building) {
		clearInterval(building)
	}
	building = setInterval(() => {
		buildStatusItem.text = `${animation()} building`
	}, 100)
}

function frame() {
	var i = 0;
	return function () {
		return frames[i = ++i % frames.length];
	};
};

export function makeBuildStatusFailed() {
	clearInterval(building)
	buildStatusItem.text = '$(issue-opened) build failed'
	buildStatusItem.color = "red"
}

export function makeBuildStatusSuccessful() {
	clearInterval(building)
	buildStatusItem.text = '$(check) build succeeded'
	buildStatusItem.color = originalBuildStatusItemColor
}


function isSPMProject(): boolean {
	return fs.existsSync(swiftPackageManifestPath)
}


export function trace(...msg: any[]) {
	if (isTracingOn) {
		console.log(...msg)
	}
}

export function dumpInConsole(msg: string) {
	spmChannel.append(msg)
}

// function getSkProtocolProcessPath(extPath: string) {
// 	switch (os.platform()) {
// 		case 'darwin':
// 			return path.join(extPath, "bin", "macos", 'sourcekitd-repl')
// 		default://FIXME
// 			return path.join(extPath, "bin", "linux", 'sourcekitd-repl')
// 	}
// }

function checkToolsAvailability() {
	swiftBinPath = <string>workspace.getConfiguration().get('swift.path.swift_driver_bin')
	const sourcekitePath = <string>workspace.getConfiguration().get('swift.path.sourcekite')
	const sourcekitePathEnableShCmd = <string>workspace.getConfiguration().get('swift.path.sourcekiteDockerMode')
	const shellPath = <string>workspace.getConfiguration().get('swift.path.shell')
	// const useBuiltInBin = <boolean>workspace.getConfiguration().get('swift.sourcekit.use_built_in_bin')
	// if (useBuiltInBin) {
	// 	skProtocolProcess = getSkProtocolProcessPath(
	// 		extensions.getExtension(PUBLISHER_NAME).extensionPath)
	// } else {
	skProtocolProcess = sourcekitePath
	skProtocolProcessAsShellCmd = sourcekitePathEnableShCmd
	// }


	if (!swiftBinPath || !fs.existsSync(swiftBinPath)) {
		window.showErrorMessage('missing dependent swift tool, please configure correct "swift.path.swift_driver_bin"')
	}
	if (!sourcekitePathEnableShCmd) {
		if (!skProtocolProcess || !fs.existsSync(skProtocolProcess)) {
			window.showErrorMessage('missing dependent sourcekite tool, please configure correct "swift.path.sourcekite"')
		}
	}
	if (!shellPath || !fs.existsSync(shellPath)) {
		window.showErrorMessage('missing dependent shell tool, please configure correct "swift.path.shell"')
	}
}
