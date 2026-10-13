import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError, fieldError } from "../api/client";
import Button from "../components/common/Button";
import ErrorMessage from "../components/common/ErrorMessage";
import Input from "../components/common/Input";
import PageContainer from "../components/common/PageContainer";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const nextFieldErrors = {};
    if (!email.trim()) nextFieldErrors.email = "Email is required.";
    if (!password) nextFieldErrors.password = "Password is required.";
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.errors || {});
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <PageContainer title="Log in" subtitle="Sign in to rate games, comment, and save favorites.">
      <form className="card form" onSubmit={handleSubmit} noValidate>
        {formError && <ErrorMessage title="Unable to log in" message={formError} />}
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError(fieldErrors, "email")}
          required
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldError(fieldErrors, "password")}
          required
        />
        <Button type="submit" loading={submitting}>
          Log in
        </Button>
        <p className="form__footer">
          No account yet? <Link to="/register">Create one</Link>
        </p>
      </form>
    </PageContainer>
  );
}
