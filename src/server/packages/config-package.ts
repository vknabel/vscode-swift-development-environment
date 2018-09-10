import * as fs from "fs";
import * as path from "path";
import { Current } from "../current";
import { Package } from "../package";
import { expandingSourceGlob } from "../path-helpers";

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
