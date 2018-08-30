import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";
import { Package, Path, Target } from "../package";

interface DebugYaml {
  client: {
    name: "swift-build";
  };
  tools: {};
  targets: { [llTarget: string]: string[] };
  default: string;
  commands: {
    [command: string]: LLCommand;
  };
}

interface LLCommand {
  "module-name": string;
  sources?: string[];
  "import-paths"?: string[];
  "other-args"?: string[];
}

export const debugYamlPackage: Package = async fromPath => {
  let debugContents: string;
  try {
    debugContents = await contentsOfDebugOrReleaseYaml(fromPath);
  } catch (error) {
    return [];
  }
  const debugYaml = yaml.safeLoad(debugContents) as DebugYaml;
  const targets: Target[] = [];
  for (const name in debugYaml.commands) {
    const command = debugYaml.commands[name];
    if (command.sources == null || command.sources.length === 0) {
      continue;
    }
    targets.push({
      name: command["module-name"] || name,
      path: fromPath, // actually a subfolder, but all paths are absolute
      sources: new Set(
        command.sources.map(toSource =>
          path.normalize(path.resolve(fromPath, toSource))
        )
      ),
      compilerArguments: compilerArgumentsForCommand(command)
    });
  }
  return targets;
};

function contentsOfFile(file: Path) {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(file, "utf8", (error, data) => {
      if (typeof data === "string") {
        resolve(data);
      } else {
        reject(error);
      }
    });
  });
}

function compilerArgumentsForCommand(command: LLCommand): string[] {
  const importPaths = command["import-paths"] || [];
  const otherArgs = command["other-args"] || [];
  const moduleNameArgs =
    (command["module-name"] && [
      "-module-name",
      command["module-name"],
      "-Onone"
    ]) ||
    [];
  const importPathArgs = importPaths.map(importPath => [
    "-Xcc",
    "-I",
    "-Xcc",
    importPath,
    "-I",
    importPath,
    "-Xcc",
    "-F",
    "-Xcc",
    importPath,
    "-F",
    importPath
  ]);
  return otherArgs.concat(moduleNameArgs, ...importPathArgs);
}

function contentsOfDebugOrReleaseYaml(fromPath: Path) {
  return contentsOfFile(path.resolve(fromPath, ".build", "debug.yaml")).catch(
    () => contentsOfFile(path.resolve(fromPath, ".build", "release.yaml"))
  );
}
