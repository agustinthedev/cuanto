import { useState, type SetStateAction } from "react";
import type { Tag } from "../services/types";
import { addProductTag, removeProductTag } from "./productTagSelection";

interface ProductTagSelectorProps {
  tags: Tag[];
  selectedTagIds: string[];
  onChange: (tagIds: SetStateAction<string[]>) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}

export function ProductTagSelector({ tags, selectedTagIds, onChange, onCreateTag, onBusyChange, disabled = false }: ProductTagSelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const selectedTags = selectedTagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is Tag => Boolean(tag));
  const availableTags = tags.filter((tag) => !selectedTagIds.includes(tag.id));

  function addTag(tagId: string) {
    if (!tagId) return;
    onChange((current) => addProductTag(current, tagId));
  }

  function removeTag(tagId: string) {
    onChange((current) => removeProductTag(current, tagId));
  }

  async function handleCreateTag() {
    const trimmedName = newTagName.trim();
    if (!trimmedName) {
      setCreateError("Escribí un nombre para el tag.");
      return;
    }
    setCreateError(null);
    setCreating(true);
    onBusyChange?.(true);
    try {
      const tag = await onCreateTag(trimmedName);
      onChange((current) => addProductTag(current, tag.id));
      setNewTagName("");
      setShowCreateForm(false);
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : "No pudimos crear el tag.");
    } finally {
      setCreating(false);
      onBusyChange?.(false);
    }
  }

  return (
    <fieldset className="admin-tags-fieldset">
      <legend>Tags</legend>
      <div className="admin-tags-picker">
        <select
          aria-label="Agregar tag"
          value=""
          onChange={(event) => addTag(event.target.value)}
          disabled={disabled || creating || availableTags.length === 0}
        >
          <option value="">{availableTags.length ? "Seleccioná un tag" : "Todos los tags seleccionados"}</option>
          {availableTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
        </select>
        <button
          className="admin-tag-create-button"
          type="button"
          onClick={() => { setCreateError(null); setShowCreateForm((current) => !current); }}
          disabled={disabled || creating}
        >
          <span aria-hidden="true">＋</span> Crear tag
        </button>
      </div>

      {selectedTags.length > 0 ? (
        <div className="admin-tags-list" aria-label="Tags seleccionados">
          {selectedTags.map((tag) => (
            <span className="admin-tag-chip" key={tag.id}>
              {tag.name}
              <button type="button" onClick={() => removeTag(tag.id)} disabled={disabled || creating} aria-label={`Quitar tag ${tag.name}`}>×</button>
            </span>
          ))}
        </div>
      ) : null}

      {showCreateForm && !disabled && (
        <div className="admin-tag-create-form" role="group" aria-label="Crear un nuevo tag">
          <input
            autoFocus
            value={newTagName}
            onChange={(event) => { setNewTagName(event.target.value); setCreateError(null); }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleCreateTag(); } }}
            placeholder="Nombre del nuevo tag"
            maxLength={80}
            aria-label="Nombre del nuevo tag"
            disabled={creating}
          />
          <button className="admin-tag-icon-button admin-tag-confirm-button" type="button" onClick={() => void handleCreateTag()} disabled={creating} aria-label={creating ? "Creando tag" : "Crear tag"} title={creating ? "Creando tag" : "Crear tag"}><span aria-hidden="true">{creating ? "…" : "✓"}</span></button>
          <button className="admin-tag-icon-button admin-tag-cancel-button" type="button" onClick={() => { setShowCreateForm(false); setNewTagName(""); setCreateError(null); }} disabled={creating} aria-label="Cancelar creación del tag" title="Cancelar creación del tag"><span aria-hidden="true">×</span></button>
          {createError && <small className="admin-tag-create-error" role="alert">{createError}</small>}
        </div>
      )}
    </fieldset>
  );
}
