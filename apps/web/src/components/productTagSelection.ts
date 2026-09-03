export function addProductTag(currentTagIds: string[], tagId: string): string[] {
  if (!tagId || currentTagIds.includes(tagId)) return currentTagIds;
  return [...currentTagIds, tagId];
}

export function removeProductTag(currentTagIds: string[], tagId: string): string[] {
  return currentTagIds.filter((currentTagId) => currentTagId !== tagId);
}
