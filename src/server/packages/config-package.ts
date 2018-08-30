import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
import { Current } from "../current";
import { Package } from "../package";

export const configPackage: Package = async fromPath => {
  const targets = Current.config.targets
    .filter(
      ({ path: targetPath }) =>
        path.isAbsolute(targetPath) ||
        fs.existsSync(path.resolve(fromPath, targetPath))
    )
    .map(async configTarget => {
      const targetPath = path.normalize(
        path.resolve(fromPath, configTarget.path)
      );
      console.log("targetPath", targetPath);
      const expandedSources = (configTarget.sources || ["**/*.swift"]).map(
        expandingSourceGlob(fromPath, targetPath)
      );
      const sources = await Promise.all(expandedSources);
      return {
        ...configTarget,
        path: targetPath,
        sources: new Set([].concat(...sources)),
        compilerArguments: configTarget.compilerArguments || []
      };
    });
  return await Promise.all(targets);
};

const expandingSourceGlob = (fromPath: string, targetPath: string) => (
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
