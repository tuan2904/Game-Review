import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError, fieldError } from "../api/client";
import Button from "../components/common/Button";
import ErrorMessage from "../components/common/ErrorMessage";
import Input from "../components/common/Input";
import PageContainer from "../components/common/PageContainer";
import { useAuth } from "../contexts/AuthContext";

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const nextFieldErrors = {};
    if (!values.email.trim()) nextFieldErrors.email = "Email is required.";
    if (!values.password) nextFieldErrors.password = "Password is required.";
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email: values.email.trim(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
      });
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
    <PageContainer
      title="Create account"
      subtitle="Rate games, join discussions, and save favorites."
    >
      <form className="card form" onSubmit={handleSubmit} noValidate>
        {formError && <ErrorMessage title="Unable to register" message={formError} />}
        <div className="form__row">
          <Input
            label="First name"
            name="firstName"
            autoComplete="given-name"
            value={values.firstName}
            onChange={updateField}
            error={fieldError(fieldErrors, "first_name")}
          />
          <Input
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            value={values.lastName}
            onChange={updateField}
            error={fieldError(fieldErrors, "last_name")}
          />
        </div>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={values.email}
          onChange={updateField}
          error={fieldError(fieldErrors, "email")}
          required
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          onChange={updateField}
          error={fieldError(fieldErrors, "password")}
          required
        />
        <Button type="submit" loading={submitting}>
          Sign up
        </Button>
        <p className="form__footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </PageContainer>
  );
}
