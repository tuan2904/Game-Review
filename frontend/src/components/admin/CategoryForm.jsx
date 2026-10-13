import { useState } from "react";
import { ApiError, fieldError } from "../../api/client";
import Button from "../common/Button";
import Input from "../common/Input";

/**
 * Admin category form (create or inline edit) — docs/API.md: `{name}`
 * required, `slug` optional (auto-generated when left blank). Read-only
 * fields (`id`) are never sent. Client validation mirrors the backend
 * (unique name/slug are server-checked and rendered inline); submission is
 * guarded while pending and values are kept on failure.
 *
 * @param {Object} props
 * @param {import("../../types").Category} [props.category] edit prefill (omit for create)
 * @param {string} [props.submitLabel]
 * @param {(payload: { name: string, slug?: string }) => Promise<unknown>} props.onSubmit
 * @param {() => void} [props.onCancel]
 */
export default function CategoryForm({ category, submitLabel = "Save", onSubmit, onCancel }) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const next = {};
    if (!name.trim()) next.name = "Name is required.";
    if (slug.trim() && /^\d+$/.test(slug.trim())) {
      next.slug = "Slug cannot be purely numeric.";
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const payload = { name: name.trim() };
    const trimmedSlug = slug.trim();
    if (trimmedSlug) payload.slug = trimmedSlug;

    setSubmitting(true);
    setFormError("");
    try {
      await onSubmit(payload);
    } catch (error) {
      const serverErrors = error instanceof ApiError ? error.errors : undefined;
      setErrors({
        name: fieldError(serverErrors, "name") || "",
        slug: fieldError(serverErrors, "slug") || "",
      });
      setFormError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      <div className="admin-form__row">
        <Input
          label="Name"
          value={name}
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value);
            setErrors((current) => ({ ...current, name: "" }));
          }}
        />
        <Input
          label="Slug (optional)"
          hint="Leave blank to auto-generate (create) or keep the current slug (edit)."
          value={slug}
          error={errors.slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setErrors((current) => ({ ...current, slug: "" }));
          }}
        />
      </div>

      {formError && (
        <div className="alert alert--error" role="alert">
          <p className="alert__message">{formError}</p>
        </div>
      )}

      <div className="admin-form__actions">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
