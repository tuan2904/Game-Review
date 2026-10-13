import { Link } from "react-router-dom";
import PageContainer from "../components/common/PageContainer";

export default function NotFound() {
  return (
    <PageContainer title="Page not found" subtitle="The page you requested does not exist.">
      <div className="card">
        <p className="muted">Check the address, or head back to a known page.</p>
        <div className="stack-horizontal">
          <Link className="btn btn--primary" to="/">
            Go home
          </Link>
          <Link className="btn btn--secondary" to="/games">
            Browse games
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
