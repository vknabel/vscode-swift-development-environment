import { Target } from "../package";
import * as path from "path";

export function flatteningTargetsWithUniqueSources(
  ...targets: Target[][]
): Target[] {
  return targets.reduce(
    (current, next) => [
      ...current,
      ...removingDuplicateSources(next, current.map(normalizedTarget))
    ],
    []
  );
}

export function removingDuplicateSources(
  fromTargets: Target[],
  uniqueTargets: Target[]
): Target[] {
  return fromTargets.map(target => {
    const swiftFilesWithoutTargets = Array.from(target.sources).filter(
      source =>
        uniqueTargets.findIndex(desc =>
          desc.sources.has(path.resolve(target.path, source))
        ) === -1
    );
    return { ...target, sources: new Set(swiftFilesWithoutTargets) };
  });
}

function normalizedTarget(target: Target): Target {
  return {
    ...target,
    sources: mapSet(target.sources, source => path.resolve(target.path, source))
  };
}
function mapSet<T, R>(set: Set<T>, transform: (element: T) => R): Set<R> {
  return new Set(Array.from(set.values()).map(element => transform(element)));
}
