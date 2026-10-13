import { useId, useState } from "react";
import { ApiError, fieldError } from "../../api/client";
import Button from "../common/Button";
import Input from "../common/Input";

const REQUIRED_FIELDS = [
  ["name", "Name is required."],
  ["description", "Description is required."],
  ["developer", "Developer is required."],
  ["publisher", "Publisher is required."],
];

const SERVER_FIELD_KEYS = [
  "name",
  "slug",
  "description",
  "developer",
  "publisher",
  "release_date",
  "cover_image",
  "status",
  "category_id",
];

function initialValues(game) {
  return {
    name: game?.name ?? "",
    slug: game?.slug ?? "",
    description: game?.description ?? "",
    developer: game?.developer ?? "",
    publisher: game?.publisher ?? "",
    release_date: game?.release_date ?? "",
    cover_image: game?.cover_image ?? "",
    status: game?.status ?? "ACTIVE",
    category_id: game?.category ? String(game.category.id) : "",
  };
}

/**
 * Admin game form used for both create and edit (docs/API.md — Game API).
 *
 * Only verified writable fields are present: `name`, `slug` (optional,
 * auto-generated/kept when blank), `description`, `developer`, `publisher`,
 * `release_date`, `cover_image`, `status`, `category_id`. Read-only payload
 * fields (`id`, nested `category`, timestamps) are never sent.
 *
 * Client validation mirrors the backend rules (required fields, ISO date,
 * non-numeric slug); server field errors (`ApiError.errors.*`) render
 * inline and the general message renders as an alert. Submission is guarded
 * while pending and nothing is optimistic — values are kept on failure.
 *
 * @param {Object} props
 * @param {import("../../types").Game} [props.game] edit mode prefill (omit for create)
 * @param {import("../../types").Category[]} props.categories options for `category_id`
 * @param {string} [props.submitLabel]
 * @param {(payload: import("../../types").GameWritePayload) => Promise<unknown>} props.onSubmit
 * @param {() => void} props.onCancel
 */
export default function GameForm({ game, categories, submitLabel = "Save", onSubmit, onCancel }) {
  const descriptionId = useId();
  const statusId = useId();
  const categoryId = useId();
  const descriptionErrorId = `${descriptionId}-error`;

  const [values, setValues] = useState(() => initialValues(game));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function setField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function validate() {
    const next = {};
    for (const [field, message] of REQUIRED_FIELDS) {
      if (!values[field].trim()) next[field] = message;
    }
    if (!values.release_date) {
      next.release_date = "Release date is required.";
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.release_date)) {
      next.release_date = "Enter a valid date.";
    }
    if (!values.category_id) next.category_id = "Choose a category.";
    if (values.slug && /^\d+$/.test(values.slug.trim())) {
      next.slug = "Slug cannot be purely numeric.";
    }
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const next = validate();
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const payload = {
      name: values.name.trim(),
      description: values.description.trim(),
      developer: values.developer.trim(),
      publisher: values.publisher.trim(),
      release_date: values.release_date,
      cover_image: values.cover_image.trim(),
      status: values.status,
      category_id: Number(values.category_id),
    };
    const slug = values.slug.trim();
    if (slug) payload.slug = slug;

    setSubmitting(true);
    setFormError("");
    try {
      await onSubmit(payload);
    } catch (error) {
      const serverErrors = error instanceof ApiError ? error.errors : undefined;
      const mapped = {};
      for (const key of SERVER_FIELD_KEYS) {
        mapped[key] = fieldError(serverErrors, key) || "";
      }
      setErrors(mapped);
      setFormError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      <Input
        label="Name"
        value={values.name}
        error={errors.name}
        onChange={(event) => setField("name", event.target.value)}
      />
      <Input
        label="Slug (optional)"
        hint="Leave blank to auto-generate (create) or keep the current slug (edit)."
        value={values.slug}
        error={errors.slug}
        onChange={(event) => setField("slug", event.target.value)}
      />

      <div className="field">
        <label className="field__label" htmlFor={descriptionId}>
          Description
        </label>
        <textarea
          id={descriptionId}
          className="field__input field__textarea"
          rows={5}
          value={values.description}
          onChange={(event) => setField("description", event.target.value)}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? descriptionErrorId : undefined}
        />
        {errors.description && (
          <p className="field__error" id={descriptionErrorId} role="alert">
            {errors.description}
          </p>
        )}
      </div>

      <div className="admin-form__row">
        <Input
          label="Developer"
          value={values.developer}
          error={errors.developer}
          onChange={(event) => setField("developer", event.target.value)}
        />
        <Input
          label="Publisher"
          value={values.publisher}
          error={errors.publisher}
          onChange={(event) => setField("publisher", event.target.value)}
        />
      </div>

      <div className="admin-form__row">
        <Input
          label="Release date"
          type="date"
          value={values.release_date}
          error={errors.release_date}
          onChange={(event) => setField("release_date", event.target.value)}
        />
        <Input
          label="Cover image URL (optional)"
          type="url"
          value={values.cover_image}
          error={errors.cover_image}
          onChange={(event) => setField("cover_image", event.target.value)}
        />
      </div>

      <div className="admin-form__row">
        <div className="field">
          <label className="field__label" htmlFor={statusId}>
            Status
          </label>
          <select
            id={statusId}
            className="field__input"
            value={values.status}
            onChange={(event) => setField("status", event.target.value)}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          {errors.status && (
            <p className="field__error" role="alert">
              {errors.status}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={categoryId}>
            Category
          </label>
          <select
            id={categoryId}
            className="field__input"
            value={values.category_id}
            onChange={(event) => setField("category_id", event.target.value)}
            aria-invalid={errors.category_id ? true : undefined}
          >
            <option value="">Choose a category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.category_id && (
            <p className="field__error" role="alert">
              {errors.category_id}
            </p>
          )}
        </div>
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
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
