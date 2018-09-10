export type Path = string;

export type Package = (fromPath: Path) => Promise<Target[]>;

export interface Target {
  name: string;
  path: Path;
  sources: Set<Path>;
  compilerArguments: string[];
}
