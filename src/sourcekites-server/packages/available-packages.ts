import { descriptionPackage } from "./description-package";
import { Package } from "../package";
import { swiftFilePackage } from "./swift-file-package";
import { debugYamlPackage } from "./debug-yaml-package";
import { configPackage } from "./config-package";
import { flatteningTargetsWithUniqueSources } from "./package-helpers";

export const availablePackages: Package = async fromPath => {
  const [
    configTargets,
    debugYamlTargets,
    descriptionTargets,
    swiftFileTargets,
  ] = await Promise.all([
    configPackage(fromPath),
    debugYamlPackage(fromPath),
    descriptionPackage(fromPath),
    swiftFilePackage(fromPath),
  ]);
  return flatteningTargetsWithUniqueSources(
    configTargets,
    debugYamlTargets,
    descriptionTargets,
    swiftFileTargets
  );
};
