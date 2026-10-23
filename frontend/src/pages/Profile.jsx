import { useState } from "react";
import { ApiError, fieldError } from "../api/client";
import { updateProfile } from "../api/auth";
import Button from "../components/common/Button";
import ErrorMessage from "../components/common/ErrorMessage";
import Input from "../components/common/Input";
import PageContainer from "../components/common/PageContainer";
import { useAuth } from "../contexts/AuthContext";

/**
 * Profile page — self-service display-name editing.
 *
 * The backend's `PATCH /auth/me/` accepts only `first_name`/`last_name`
 * (docs/API.md — Auth API); email and permissions are read-only, so this form
 * cannot escalate privileges. On success the AuthContext user is replaced with
 * the server's response (`updateUser`) so the header stays in sync. Server
 * field errors (`errors.first_name`/`errors.last_name`) render inline; any
 * other failure shows a recoverable alert.
 */
export default function Profile() {
  const { user, updateUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      const updated = await updateProfile({ firstName, lastName });
      updateUser(updated);
      setSaved(true);
    } catch (caught) {
      const errors = caught instanceof ApiError ? caught.errors : {};
      setFieldErrors({
        firstName: fieldError(errors, "first_name"),
        lastName: fieldError(errors, "last_name"),
      });
      setError(caught?.message || "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer title="Profile" subtitle="Manage your account details.">
      <div className="card">
        <p className="profile__email">
          Signed in as <strong>{user?.email}</strong>
        </p>

        <form className="profile__form" onSubmit={handleSubmit} noValidate>
          <Input
            label="First name"
            value={firstName}
            maxLength={150}
            autoComplete="given-name"
            error={fieldErrors.firstName || undefined}
            onChange={(event) => {
              setFirstName(event.target.value);
              setSaved(false);
            }}
          />
          <Input
            label="Last name"
            value={lastName}
            maxLength={150}
            autoComplete="family-name"
            error={fieldErrors.lastName || undefined}
            onChange={(event) => {
              setLastName(event.target.value);
              setSaved(false);
            }}
          />

          {error && <ErrorMessage title="Couldn't save profile" message={error} />}
          {saved && (
            <p className="alert alert--success" role="status">
              Profile updated.
            </p>
          )}

          <div className="profile__actions">
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
