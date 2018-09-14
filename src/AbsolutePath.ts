import * as os from "os";
import * as path from "path";

export function absolutePath(userDefinedPath: string) {
  return path.normalize(userDefinedPath.replace(/^~/, os.homedir() + "/"));
}
