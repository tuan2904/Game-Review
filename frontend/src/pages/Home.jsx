import { Link } from "react-router-dom";
import PageContainer from "../components/common/PageContainer";
import { useAuth } from "../contexts/AuthContext";

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <PageContainer
      title="GameReview"
      subtitle="Discover games, write reviews, and keep your favorites in one place."
    >
      <section className="card">
        <span className="badge badge--placeholder">Foundation</span>
        <p>
          {isAuthenticated
            ? `Welcome back, ${user?.first_name || user?.email}.`
            : "The frontend foundation (API client, auth, routing, layout) is ready."}
        </p>
        <p className="muted">
          Game browsing, reviews, comments, and favorites UI arrive in Phases 07–08 — this page is a
          placeholder, not a finished feature.
        </p>
        <div className="stack-horizontal">
          <Link className="btn btn--primary" to="/games">
            Browse games
          </Link>
          {!isAuthenticated && (
            <Link className="btn btn--secondary" to="/register">
              Create an account
            </Link>
          )}
        </div>
      </section>
    </PageContainer>
  );
}
