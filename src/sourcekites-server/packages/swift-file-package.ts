import * as fs from "fs";
import * as path from "path";
import { Package, Path } from "../package";

export const swiftFilePackage: Package = async fromPath => {
  return [
    {
      name: path.basename(fromPath),
      path: fromPath,
      sources: new Set(
        allSwiftFilesInPath(fromPath).map(file => path.normalize(path.resolve(fromPath, file)))
      ),
      compilerArguments: [],
    },
  ];
};

function allSwiftFilesInPath(root: Path): Path[] {
  const result = new Array<string>();
  try {
    const dir = fs.readdirSync(root).filter(sub => !sub.startsWith(".") && sub !== "Carthage");
    for (const sub of dir) {
      if (path.extname(sub) === ".swift") {
        result.push(path.join(root, sub));
      } else {
        result.push(...allSwiftFilesInPath(path.join(root, sub)));
      }
    }
    return result;
  } catch (error) {
    return result;
  }
}
