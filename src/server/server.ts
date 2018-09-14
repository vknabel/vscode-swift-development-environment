"use strict";

import * as path from "path";
import {
  IPCMessageReader,
  IPCMessageWriter,
  createConnection,
  IConnection,
  TextDocuments,
  TextDocument,
  InitializeParams,
  InitializeResult,
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  TextEdit,
  Hover,
  MarkedString,
  Definition,
  FileChangeType,
  Range
} from "vscode-languageserver";
import * as fs from "fs";
import * as sourcekitProtocol from "./sourcekites";
import * as childProcess from "child_process";
import { parseDocumentation } from "./sourcekit-xml";
import { Target } from "./package";
import { availablePackages } from "./packages/available-packages";
import { Current } from "./current";
export const spawn = childProcess.spawn;

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(
  new IPCMessageReader(process),
  new IPCMessageWriter(process)
);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

let targets: Target[] | null;
export async function initializeModuleMeta() {
  const loadingTargets = Current.config.workspacePaths.map(availablePackages);
  const loadedTargets = await Promise.all(loadingTargets);
  targets = [].concat(...loadedTargets);
}

export function targetForSource(srcPath: string): Target {
  return (
    (targets &&
      targets.find(target => target.sources.has(path.normalize(srcPath)))) || {
      name: path.basename(srcPath),
      path: srcPath,
      sources: new Set([srcPath]),
      compilerArguments: []
    }
  );
}

// After the server has started the client sends an initilize request. The server receives
// in the passed params the root paths of the workspaces plus the client capabilites.
connection.onInitialize(
  (params: InitializeParams, cancellationToken): InitializeResult => {
    Current.config.isTracingOn =
      params.initializationOptions.isLSPServerTracingOn;
    Current.config.workspacePaths = params.workspaceFolders.map(({ uri }) =>
      uri.replace("file://", "")
    );
    skProtocolPath = params.initializationOptions.skProtocolProcess;
    skProtocolProcessAsShellCmd =
      params.initializationOptions.skProtocolProcessAsShellCmd;
    skCompilerOptions = params.initializationOptions.skCompilerOptions;
    Current.log(
      "-->onInitialize ",
      `isTracingOn=[${Current.config.isTracingOn}],
	skProtocolProcess=[${skProtocolPath}],skProtocolProcessAsShellCmd=[${skProtocolProcessAsShellCmd}]`
    );
    return {
      capabilities: {
        // Tell the client that the server works in FULL text document sync mode
        textDocumentSync: documents.syncKind,
        definitionProvider: true,
        hoverProvider: true,
        // referencesProvider: false,
        // documentSymbolProvider: false,
        // signatureHelpProvider: {
        // 	triggerCharacters: ['[', ',']
        // },
        // We're providing completions.
        completionProvider: {
          resolveProvider: false,
          triggerCharacters: [
            ".",
            ":",
            "(",
            "#" //' ', '<', //TODO
          ]
        }
      }
    };
  }
);

// The settings interface describe the server relevant settings part
interface Settings {
  swift: any;
  editor: {
    tabSize?: number;
  };
  "[swift]": {};
}

//external
export let maxBytesAllowedForCodeCompletionResponse: number = 0;
export let editorSettings: Settings["editor"] = {};
//internal
export let skProtocolPath = null;
export let skProtocolProcessAsShellCmd = false;
export let skCompilerOptions: string[] = [];
let maxNumProblems = null;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration(change => {
  Current.log("-->onDidChangeConfiguration");
  const settings = <Settings>change.settings;
  const sdeSettings = settings.swift;
  editorSettings = { ...settings.editor, ...settings["[swift]"] };

  //FIXME does LS client support on-the-fly change?
  maxNumProblems = sdeSettings.diagnosis.max_num_problems;
  Current.config.sourcekitePath = sdeSettings.path.sourcekite;
  Current.config.swiftPath = sdeSettings.path.swift_driver_bin;
  Current.config.shellPath = sdeSettings.path.shell || "/bin/bash";
  Current.config.targets = sdeSettings.targets || [];

  Current.log(`-->onDidChangeConfiguration tracing:
	    swiftDiverBinPath=[${Current.config.swiftPath}],
		shellPath=[${Current.config.shellPath}]`);

  //FIXME reconfigure when configs haved
  sourcekitProtocol.initializeSourcekite();
  if (!targets) {
    //FIXME oneshot?
    initializeModuleMeta();
  }
  // Revalidate any open text documents
  documents.all().forEach(validateTextDocument);
});

function validateTextDocument(textDocument: TextDocument): void {
  // let diagnostics: Diagnostic[] = [];
  // let lines = textDocument.getText().split(/\r?\n/g);
  // let problems = 0;
  // for (var i = 0; i < lines.length && problems < maxNumProblems; i++) {
  // 	let line = lines[i];
  // 	let index = line.indexOf('typescript');
  // 	if (index >= 0) {
  // 		problems++;
  // 		diagnostics.push({
  // 			severity: DiagnosticSeverity.Warning,
  // 			range: {
  // 				start: { line: i, character: index },
  // 				end: { line: i, character: index + 10 }
  // 			},
  // 			message: `${line.substr(index, 10)} should be spelled TypeScript`,
  // 			source: 'ex'
  // 		});
  // 	}
  // }
  // Send the computed diagnostics to VSCode.
  // connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
  Current.log("---onDidChangeContent");
});

connection.onDidChangeWatchedFiles(watched => {
  // trace('---','onDidChangeWatchedFiles');
  watched.changes.forEach(e => {
    let file: string;
    switch (e.type) {
      case FileChangeType.Created:
        file = fromUriString(e.uri);
        targetForSource(file).sources.add(file);
        break;
      case FileChangeType.Deleted:
        file = fromUriString(e.uri);
        targetForSource(file).sources.delete(file);
        break;
      default:
      //do nothing
    }
  });
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  ({ textDocument, position }): Thenable<CompletionItem[]> => {
    function removeSubstringFix(sub: string, replacement = ""): TextEdit[] {
      const prefixOffset = offset - Math.max(3, sub.length * 2 - 1);
      const prefix = srcText.slice(prefixOffset, offset);
      const lastOccurence = prefix.lastIndexOf(sub);
      if (lastOccurence === -1) return [];
      const duplicateKeywordRange = Range.create(
        document.positionAt(prefixOffset + lastOccurence),
        document.positionAt(prefixOffset + lastOccurence + sub.length)
      );
      return [TextEdit.replace(duplicateKeywordRange, replacement)];
    }
    function completionOfDuplicateFuncKeywordFix(kind: string): TextEdit[] {
      return (
        (kind.includes("source.lang.swift.decl.function.") &&
          removeSubstringFix("func ")) ||
        []
      );
    }
    function completionOfDuplicateDotFix(kind: string): TextEdit[] {
      return (
        (kind.includes("source.lang.swift.decl.function.") &&
          removeSubstringFix("..", ".")) ||
        []
      );
    }
    function combineFixes(
      kind: string,
      ...fixes: Array<(kind: string) => TextEdit[]>
    ): TextEdit[] {
      return fixes
        .map(fix => fix(kind))
        .reduce((all, next) => [...all, ...next], []);
    }

    const document: TextDocument = documents.get(textDocument.uri);
    const srcPath = document.uri.substring(7, document.uri.length);
    const srcText: string = document.getText(); //NOTE needs on-the-fly buffer
    const offset = document.offsetAt(position); //FIXME
    return sourcekitProtocol.codeComplete(srcText, srcPath, offset).then(
      function(completions: Object[] | null) {
        return (completions || []).map(c => {
          let item = CompletionItem.create(c["key.description"]);
          item.kind = toCompletionItemKind(c["key.kind"]);
          item.detail = `${c["key.modulename"]}.${c["key.name"]}`;
          item.insertText = createSuggest(c["key.sourcetext"]);
          item.insertTextFormat = InsertTextFormat.Snippet;
          item.documentation = c["key.doc.brief"];
          item.additionalTextEdits = combineFixes(
            c["key.kind"],
            completionOfDuplicateFuncKeywordFix,
            completionOfDuplicateDotFix
          );
          return item;
        });
      },
      function(err) {
        //FIXME
        return err;
      }
    );
  }
);

/**
 * ref: https://github.com/facebook/nuclide/blob/master/pkg/nuclide-swift/lib/sourcekitten/Complete.js#L57
 */
function createSuggest(sourcetext: string): string {
  let index = 1;
  let snp = sourcetext.replace(/<#T##(.+?)#>/g, (m, g) => {
    return "${" + index++ + ":" + g.split("##")[0] + "}";
  });
  const normalized = snp.replace("<#code#>", `\${${index++}}`);
  return normalized.startsWith(".") ? normalized.slice(1) : normalized;
}

//TODO more meanful CompletionItemKinds...
function toCompletionItemKind(keyKind: string): CompletionItemKind {
  switch (keyKind) {
    case "source.lang.swift.decl.function.free":
    case "source.lang.swift.ref.function.free":
      return CompletionItemKind.Function;
    case "source.lang.swift.decl.function.method.instance":
    case "source.lang.swift.ref.function.method.instance":
    case "source.lang.swift.decl.function.method.static":
    case "source.lang.swift.ref.function.method.static":
      return CompletionItemKind.Method;
    case "source.lang.swift.decl.function.operator":
    case "source.lang.swift.ref.function.operator":
    case "source.lang.swift.decl.function.subscript":
    case "source.lang.swift.ref.function.subscript":
      return CompletionItemKind.Keyword;
    case "source.lang.swift.decl.function.constructor":
    case "source.lang.swift.ref.function.constructor":
    case "source.lang.swift.decl.function.destructor":
    case "source.lang.swift.ref.function.destructor":
      return CompletionItemKind.Constructor;
    case "source.lang.swift.decl.function.accessor.getter":
    case "source.lang.swift.ref.function.accessor.getter":
    case "source.lang.swift.decl.function.accessor.setter":
    case "source.lang.swift.ref.function.accessor.setter":
      return CompletionItemKind.Property;
    case "source.lang.swift.decl.class":
    case "source.lang.swift.ref.class":
    case "source.lang.swift.decl.struct":
    case "source.lang.swift.ref.struct":
      return CompletionItemKind.Class;
    case "source.lang.swift.decl.enum":
    case "source.lang.swift.ref.enum":
      return CompletionItemKind.Enum;
    case "source.lang.swift.decl.enumelement":
    case "source.lang.swift.ref.enumelement":
      return CompletionItemKind.Value;
    case "source.lang.swift.decl.protocol":
    case "source.lang.swift.ref.protocol":
      return CompletionItemKind.Interface;
    case "source.lang.swift.decl.typealias":
    case "source.lang.swift.ref.typealias":
      return CompletionItemKind.Reference;
    case "source.lang.swift.decl.var.instance":
    case "source.lang.swift.ref.var.instance":
      return CompletionItemKind.Field;
    case "source.lang.swift.decl.var.global":
    case "source.lang.swift.ref.var.global":
    case "source.lang.swift.decl.var.static":
    case "source.lang.swift.ref.var.static":
    case "source.lang.swift.decl.var.local":
    case "source.lang.swift.ref.var.local":
      return CompletionItemKind.Variable;

    case "source.lang.swift.decl.extension.struct":
    case "source.lang.swift.decl.extension.class":
      return CompletionItemKind.Class;
    case "source.lang.swift.decl.extension.enum":
      return CompletionItemKind.Enum;
    default:
      return CompletionItemKind.Text; //FIXME
  }
}

// This handler resolve additional information for the item selected in
// the completion list.
// connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
// 	if (item.data === 1) {
// 		item.detail = 'TypeScript details',
// 			item.documentation = 'TypeScript documentation'
// 	} else if (item.data === 2) {
// 		item.detail = 'JavaScript details',
// 			item.documentation = 'JavaScript documentation'
// 	}
// 	return item;
// });

connection.onHover(
  ({ textDocument, position }): Promise<Hover> => {
    const document: TextDocument = documents.get(textDocument.uri);
    const srcPath = document.uri.substring(7, document.uri.length);
    const srcText: string = document.getText(); //NOTE needs on-the-fly buffer
    const offset = document.offsetAt(position); //FIXME
    return sourcekitProtocol.cursorInfo(srcText, srcPath, offset).then(
      function(cursorInfo) {
        return extractHoverHelp(cursorInfo).then(mks => {
          return { contents: mks || [] };
        });
      },
      function(err) {
        //FIXME
        return err;
      }
    );
  }
);

/**
 * sadasd
 * @param cursorInfo s
 */
async function extractHoverHelp(cursorInfo: Object): Promise<MarkedString[]> {
  //local helper
  function extractText(elementName: string, full_as_xml: string) {
    let s = full_as_xml.indexOf(`<${elementName}>`);
    let e = full_as_xml.indexOf(`</${elementName}>`);
    let rt = full_as_xml.substring(s + elementName.length + 2, e);
    return rt;
  }
  //TODO wait vscode to support full html rendering...
  //stripe all sub elements
  function stripeOutTags(str) {
    return str.replace(/(<.[^(><.)]+>)/g, (m, c) => "");
  }

  const keyKind = cursorInfo["key.kind"];
  const keyName = cursorInfo["key.name"];
  if (!keyName) {
    return null;
  }

  const full_as_xml = cursorInfo["key.doc.full_as_xml"];
  const annotated_decl = cursorInfo["key.annotated_decl"];
  const moduleName = cursorInfo["key.modulename"];
  const containerTypeUSR = cursorInfo["key.containertypeusr"];
  let containerType = null;
  if (containerTypeUSR) {
    const res: Array<Object> = await sourcekitProtocol.demangle(
      containerTypeUSR
    );
    containerType = res ? res.map(t => t["key.name"]).join(",") : null;
  }
  const t = { language: "markdown", value: keyName };
  const snippet = annotated_decl
    ? "**Declaration:**\n```swift\n" +
      decode(
        stripeOutTags(extractText("Declaration", full_as_xml || annotated_decl))
      ) +
      "\n```\n" +
      (containerType ? `**Declared In**:  ${containerType}\n\n` : "") +
      (moduleName ? `**Module**:  ${moduleName}` : "")
    : keyName;
  return [snippet, t, ...parseDocumentation(full_as_xml)]; //FIXME clickable keyTypename
}

connection.onDefinition(
  ({ textDocument, position }): Promise<Definition> => {
    const document: TextDocument = documents.get(textDocument.uri);
    const srcPath = document.uri.substring(7, document.uri.length);
    const srcText: string = document.getText(); //NOTE needs on-the-fly buffer
    const offset = document.offsetAt(position); //FIXME
    return sourcekitProtocol.cursorInfo(srcText, srcPath, offset).then(
      function(cursorInfo) {
        const filepath = cursorInfo["key.filepath"];
        if (filepath) {
          const offset = cursorInfo["key.offset"];
          const len = cursorInfo["key.length"];
          const fileUri = `file://${filepath}`;
          let document: TextDocument = documents.get(fileUri); //FIXME
          //FIXME more here: https://github.com/Microsoft/language-server-protocol/issues/96
          if (!document) {
            //FIXME just make a temp doc to let vscode help us
            const content = fs.readFileSync(filepath, "utf8");
            document = TextDocument.create(fileUri, "swift", 0, content);
          }
          return {
            uri: fileUri,
            range: {
              start: document.positionAt(offset),
              end: document.positionAt(offset + len)
            }
          };
        } else {
          return null;
        }
      },
      function(err) {
        //FIXME
        return err;
      }
    );
  }
);

function fromDocumentUri(document: { uri: string }): string {
  // return Files.uriToFilePath(document.uri);
  return fromUriString(document.uri);
}

function fromUriString(uri: string): string {
  return uri.substring(7, uri.length);
}

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.uri} opened.`);
});

connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});

connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.uri} closed.`);
});
*/

// Listen on the connection
connection.listen();

//=== helper

const xmlEntities = {
  "&amp;": "&",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">"
};
function decode(str) {
  return str.replace(/(&quot;|&lt;|&gt;|&amp;)/g, (m, c) => xmlEntities[c]);
}

//FIX issue#15
export function getShellExecPath() {
  return fs.existsSync(Current.config.shellPath)
    ? Current.config.shellPath
    : "/usr/bin/sh";
}
