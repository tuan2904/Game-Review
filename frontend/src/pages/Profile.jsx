import PageContainer from "../components/common/PageContainer";
import { useAuth } from "../contexts/AuthContext";

export default function Profile() {
  const { user } = useAuth();

  return (
    <PageContainer title="Profile">
      <div className="card">
        <span className="badge badge--placeholder">Placeholder</span>
        <p>
          Signed in as <strong>{user?.email}</strong>
        </p>
        <p className="muted">
          Profile editing and account details are not implemented — this authenticated page exists
          to demonstrate protected routing.
        </p>
      </div>
    </PageContainer>
  );
}
