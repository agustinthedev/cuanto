import { useState } from "react";
import type { Tag } from "../services/types";

interface ProductTagSelectorProps {
  tags: Tag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  disabled?: boolean;
}

export function ProductTagSelector({ tags, selectedTagIds, onChange, onCreateTag, disabled = false }: ProductTagSelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const selectedTags = selectedTagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is Tag => Boolean(tag));
  const availableTags = tags.filter((tag) => !selectedTagIds.includes(tag.id));

  function addTag(tagId: string) {
    if (!tagId || selectedTagIds.includes(tagId)) return;
    onChange([...selectedTagIds, tagId]);
  }

  function removeTag(tagId: string) {
    onChange(selectedTagIds.filter((item) => item !== tagId));
  }

  async function handleCreateTag() {
    const trimmedName = newTagName.trim();
    if (!trimmedName) {
      setCreateError("Escribí un nombre para el tag.");
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      const tag = await onCreateTag(trimmedName);
      if (!selectedTagIds.includes(tag.id)) onChange([...selectedTagIds, tag.id]);
      setNewTagName("");
      setShowCreateForm(false);
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : "No pudimos crear el tag.");
    } finally {
      setCreating(false);
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
          disabled={disabled || availableTags.length === 0}
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
              <button type="button" onClick={() => removeTag(tag.id)} disabled={disabled} aria-label={`Quitar tag ${tag.name}`}>×</button>
            </span>
          ))}
        </div>
      ) : (
        <small className="admin-field-hint">Podés asociar uno o varios tags al producto.</small>
      )}

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
          <button className="button button-secondary" type="button" onClick={() => void handleCreateTag()} disabled={creating}>{creating ? "Creando..." : "Crear"}</button>
          <button className="admin-tag-cancel-button" type="button" onClick={() => { setShowCreateForm(false); setNewTagName(""); setCreateError(null); }} disabled={creating}>Cancelar</button>
          {createError && <small className="admin-tag-create-error" role="alert">{createError}</small>}
        </div>
      )}
    </fieldset>
  );
}
