import * as path from "path";
import { Current } from "../current";
import { Package, Target, Path } from "../package";
const joinPath = path.join;

type PackageDescription =
  | { targets: TargetDescription[]; modules: undefined }
  | { targets: undefined; modules: TargetDescription[] };
interface TargetDescription {
  name: string;
  path: string;
  sources: string[];
}

export const descriptionPackage: Package = async fromPath => {
  try {
    const data = await Current.swift(fromPath, `package describe --type json`);
    const packageDescription = JSON.parse(data) as PackageDescription;
    const targetDescription = packageDescription.modules || packageDescription.targets;
    return targetDescription.map(targetFromDescriptionFromPath(fromPath));
  } catch (error) {
    Current.report(error);
    return [];
  }
};

function targetFromDescriptionFromPath(fromPath: Path) {
  return ({ name, path, sources }: TargetDescription): Target => {
    return {
      name,
      path,
      sources: new Set(sources),
      compilerArguments: [
        "-I",
        joinPath(fromPath, ".build", "debug"),
        ...Current.defaultCompilerArguments(),
      ],
    };
  };
}
