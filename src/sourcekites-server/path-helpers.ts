import * as path from "path";
import * as glob from "glob";

export const expandingSourceGlob = (fromPath: string, targetPath: string) => (
  sourceGlob: string
) => {
  return new Promise<string[]>((resolve, reject) => {
    const options: glob.IOptions = {
      cwd: targetPath,
      root: fromPath
    };
    glob(sourceGlob, options, (error, matches) => {
      if (error) {
        reject(error);
      } else {
        resolve(
          matches.map(match => path.normalize(path.resolve(targetPath, match)))
        );
      }
    });
  });
};

export const compilerArgumentsForImportPath = (importPath: string) => [
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
];
