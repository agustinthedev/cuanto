import { describe, expect, it } from "vitest";
import { addProductTag, removeProductTag } from "./productTagSelection";

describe("product tag selection", () => {
  it("adds a tag without duplicating an existing selection", () => {
    expect(addProductTag(["tag-existing"], "tag-new")).toEqual(["tag-existing", "tag-new"]);
    expect(addProductTag(["tag-existing"], "tag-existing")).toEqual(["tag-existing"]);
  });

  it("preserves the latest selection when a pending tag creation resolves", async () => {
    let resolveCreation!: (tagId: string) => void;
    const creation = new Promise<string>((resolve) => { resolveCreation = resolve; });
    let selectedTagIds = ["tag-existing"];
    const applySelectionUpdate = (update: (currentTagIds: string[]) => string[]) => {
      selectedTagIds = update(selectedTagIds);
    };

    const applyCreatedTag = creation.then((tagId) => {
      applySelectionUpdate((currentTagIds) => addProductTag(currentTagIds, tagId));
    });
    applySelectionUpdate((currentTagIds) => addProductTag(currentTagIds, "tag-added-while-pending"));
    resolveCreation("tag-created");

    await applyCreatedTag;
    expect(selectedTagIds).toEqual(["tag-existing", "tag-added-while-pending", "tag-created"]);
  });

  it("removes only the requested tag", () => {
    expect(removeProductTag(["tag-one", "tag-two"], "tag-one")).toEqual(["tag-two"]);
  });
});
