export interface Current {
  log(label: string, ...details: any[]);
  report(label: string, ...details: any[]);
  spawn(command: string): Promise<string>;
  swift(inPath: string, command: string): Promise<string>;
  defaultCompilerArguments(): string[];
  config: {
    isTracingOn: boolean;
    swiftPath: string;
    sourcekitePath: string;
    shellPath: string;
    sourceKitCompilerOptions: string[];
    workspacePaths: string[];
    toolchainPath: string | null;
    targets: Array<{
      name: string;
      path: string;
      sources?: string[];
      compilerArguments?: string[];
    }>;
  };
}

import * as childProcess from "child_process";

async function spawn(cmd: string) {
  let buffer = "";
  return new Promise<string>((resolve, reject) => {
    const sp = childProcess.spawn(Current.config.shellPath, ["-c", cmd]);
    sp.stdout.on("data", data => {
      buffer += data;
    });
    sp.on("exit", code => {
      if (code === 0) {
        resolve(buffer);
      } else {
        reject(code);
      }
    });
  });
}
async function swift(inPath: string, cmd: string) {
  return await this.spawn(`cd ${inPath} && ${Current.config.swiftPath} ${cmd}`);
}
function log(label: string, ...details: any[]) {
  if (Current.config.isTracingOn) {
    console.log(`[${label}]`, ...details);
  }
}
function report(label: string, ...details: any[]) {
  if (Current.config.isTracingOn) {
    console.log(`[ERROR][${label}]`, ...details);
  }
}
function defaultCompilerArguments() {
  return [
    "-sdk",
    "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk",
    "-sdk",
    "/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk",
    "-sdk",
    "/Applications/Xcode.app/Contents/Developer/Platforms/WatchOS.platform/Developer/SDKs/WatchOS.sdk",
    "-sdk",
    "/Applications/Xcode.app/Contents/Developer/Platforms/AppleTVOS.platform/Developer/SDKs/AppleTVOS.sdk",
    "-I",
    "/System/Library/Frameworks/",
    "-I",
    "/usr/lib/swift/pm/",
    ...Current.config.sourceKitCompilerOptions
  ];
}

export let Current: Current = {
  log,
  report,
  spawn,
  swift,
  defaultCompilerArguments,
  config: {
    workspacePaths: [],
    isTracingOn: false,
    swiftPath: "$(which swift)",
    sourcekitePath: "$(which sourcekite)",
    shellPath: "/bin/bash",
    sourceKitCompilerOptions: [],
    targets: [],
    toolchainPath: null
  }
};
