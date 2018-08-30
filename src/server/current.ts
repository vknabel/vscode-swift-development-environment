export interface Current {
  log(label: string, ...details: any[]);
  report(label: string, ...details: any[]);
  spawn(command: string): Promise<string>;
  swift(inPath: string, command: string): Promise<string>;
  defaultCompilerArguments: () => string[];
  config: {
    isTracingOn: boolean;
    swiftPath: string;
    shellPath: string;
    sourceKitCompilerOptions: string[];
  };
}

import * as childProcess from "child_process";

async function spawn(cmd: string) {
  return new Promise<string>((resolve, reject) => {
    const sp = childProcess.spawn(Current.config.shellPath, ["-c", cmd]);
    sp.stdout.on("data", data => {
      resolve(data as string);
    });
    sp.on("error", error => {
      reject(error);
    });
  });
}
async function swift(inPath: string, cmd: string) {
  return await this.spawn(`cd ${inPath} && ${Current.config.swiftPath} ${cmd}`);
}
function log(label: string, ...details: any[]) {
  console.log(`[${label}]`, ...details);
}
function report(label: string, ...details: any[]) {
  console.log(`[ERROR][${label}]`, ...details);
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
    isTracingOn: false,
    swiftPath: "$(which swift)",
    shellPath: "/bin/bash",
    sourceKitCompilerOptions: []
  }
};
