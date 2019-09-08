import {
  removingDuplicateSources,
  flatteningTargetsWithUniqueSources
} from "./package-helpers";
import { Target } from "../package";

const uniqueTarget: Target = {
  name: "Unique",
  path: "Sources/Unique",
  sources: new Set(["Hello.swift", "main.swift"]),
  compilerArguments: []
};

const unrelatedTarget: Target = {
  name: "UnrelatedTarget",
  path: "Sources/UnrelatedTarget",
  sources: new Set(["Unrelated.swift"]),
  compilerArguments: []
};

describe("package helpers", () => {
  describe("removingDuplicateSources", () => {
    it("does not emit unique targets", () => {
      const emittedTargets = removingDuplicateSources([], [uniqueTarget]);
      expect(emittedTargets).toHaveLength(0);
    });

    it("unrelated source sets will be kept", () => {
      const emittedTargets = removingDuplicateSources(
        [unrelatedTarget],
        [uniqueTarget]
      );
      expect(emittedTargets).toEqual([unrelatedTarget]);
    });

    it("unrelated source sets with differing paths will be kept for same file names", () => {
      const unrelatedTargetWithSameFileNames: Target = {
        ...unrelatedTarget,
        sources: uniqueTarget.sources
      };

      const emittedTargets = removingDuplicateSources(
        [unrelatedTargetWithSameFileNames],
        [uniqueTarget]
      );
      expect(emittedTargets).toEqual([unrelatedTargetWithSameFileNames]);
    });

    it("source sets with same paths but different file names are kept", () => {
      const samePathTargetWithDifferentSources = {
        ...unrelatedTarget,
        path: uniqueTarget.path
      };
      const emittedTargets = removingDuplicateSources(
        [samePathTargetWithDifferentSources],
        [uniqueTarget]
      );
      expect(emittedTargets).toEqual([samePathTargetWithDifferentSources]);
    });

    it("source sets with different paths but same files will be deuplicated", () => {
      const differentPathTargetWithSameSources = {
        ...unrelatedTarget,
        path: "./",
        sources: new Set(
          Array(uniqueTarget.sources.values()).map(
            sourceFile => `${uniqueTarget.path}/${sourceFile}`
          )
        )
      };
      const emittedTargets = removingDuplicateSources(
        [differentPathTargetWithSameSources],
        [uniqueTarget]
      );
      expect(emittedTargets).toEqual([differentPathTargetWithSameSources]);
    });
  });

  describe("flatteningTargetsWithUniqueSources", () => {
    it("bug: configs did not override global paths", () => {
      // see https://github.com/vknabel/vscode-swift-development-environment/issues/55
      const emittedTargets = flatteningTargetsWithUniqueSources(
        [
          {
            name: "HiModuleFromConfigs",
            path: "/Users/vknabel/Desktop/AutocompleteIos/Sources/Hi",
            sources: new Set(["Hi.swift"]),
            compilerArguments: []
          }
        ],
        [
          {
            name: "HiModuleFromDebugYaml",
            path: "/Users/vknabel/Desktop/AutocompleteIos",
            sources: new Set([
              "/Users/vknabel/Desktop/AutocompleteIos/Sources/Hi/Hi.swift"
            ]),
            compilerArguments: []
          }
        ],
        [
          {
            name: "AutocompleteIos",
            path: "/Users/vknabel/Desktop/AutocompleteIos",
            sources: new Set([
              "/Users/vknabel/Desktop/AutocompleteIos/Package.swift"
            ]),
            compilerArguments: []
          }
        ]
      );
      expect(emittedTargets).toEqual([
        {
          name: "HiModuleFromConfigs",
          path: "/Users/vknabel/Desktop/AutocompleteIos/Sources/Hi",
          sources: new Set(["Hi.swift"]),
          compilerArguments: []
        },
        {
          name: "HiModuleFromDebugYaml",
          path: "/Users/vknabel/Desktop/AutocompleteIos",
          sources: new Set([]),
          compilerArguments: []
        },
        {
          name: "AutocompleteIos",
          path: "/Users/vknabel/Desktop/AutocompleteIos",
          sources: new Set([
            "/Users/vknabel/Desktop/AutocompleteIos/Package.swift"
          ]),
          compilerArguments: []
        }
      ]);
    });
  });
});
