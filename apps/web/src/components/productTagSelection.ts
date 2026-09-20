import type { Tag } from "../services/types";

export function normalizeProductTagSearch(value: string): string {
  return value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function filterAvailableProductTags(tags: Tag[], selectedTagIds: string[], search: string): Tag[] {
  const normalizedSearch = normalizeProductTagSearch(search);
  return tags.filter((tag) => (
    !selectedTagIds.includes(tag.id)
    && (!normalizedSearch || normalizeProductTagSearch(tag.name).includes(normalizedSearch))
  ));
}

export function addProductTag(currentTagIds: string[], tagId: string): string[] {
  if (!tagId || currentTagIds.includes(tagId)) return currentTagIds;
  return [...currentTagIds, tagId];
}

export function removeProductTag(currentTagIds: string[], tagId: string): string[] {
  return currentTagIds.filter((currentTagId) => currentTagId !== tagId);
}
