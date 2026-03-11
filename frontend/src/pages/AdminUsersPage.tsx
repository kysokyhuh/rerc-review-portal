import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import "@/styles/admin-users.css";

type PendingUser = {
  id: number;
  fullName: string;
  email: string;
  status: string;
  roles: string[];
  createdAt: string;
};

const ALLOWED_ROLES = ["CHAIR", "RESEARCH_ASSOCIATE", "RESEARCH_ASSISTANT"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/admin/users/pending");
      setUsers(res.data.users || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pendingCount = useMemo(() => users.length, [users.length]);

  const approve = async (userId: number) => {
    const role = selectedRoles[userId] || "RESEARCH_ASSISTANT";
    await api.post(`/admin/users/${userId}/approve`, { roles: [role] });
    await load();
  };

  const reject = async (userId: number) => {
    await api.post(`/admin/users/${userId}/reject`, {
      note: "Application rejected",
    });
    await load();
  };

  return (
    <div className="dashboard-content admin-page">
      <header className="queue-page-header admin-soft-header">
        <h1>Sign-Up Approval</h1>
        <p>Review pending self-signups and assign the appropriate role before activating access.</p>
        <div className="admin-header-metrics">
          <span className="admin-metric">
            Pending Accounts <strong>{pendingCount}</strong>
          </span>
        </div>
      </header>

      {error ? <div className="admin-error">{error}</div> : null}

      <section className="panel admin-soft-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Pending Requests</h2>
            <p className="panel-subtitle">Only chair accounts can approve or reject these requests.</p>
          </div>
        </div>

        <div className="panel-body no-padding">
          {loading ? <div className="admin-empty">Loading pending users...</div> : null}
          {!loading && users.length === 0 ? (
            <div className="admin-empty">No pending users.</div>
          ) : null}

          {!loading && users.length > 0 ? (
            <table className="data-table admin-soft-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Requested At</th>
                  <th>Assign Role</th>
                  <th className="table-actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="table-owner">{user.fullName}</div>
                    </td>
                    <td>{user.email}</td>
                    <td>{new Date(user.createdAt).toLocaleString()}</td>
                    <td>
                      <select
                        className="admin-select"
                        value={selectedRoles[user.id] || "RESEARCH_ASSISTANT"}
                        onChange={(e) =>
                          setSelectedRoles((prev) => ({
                            ...prev,
                            [user.id]: e.target.value,
                          }))
                        }
                      >
                        {ALLOWED_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="table-actions">
                      <div className="admin-actions">
                        <button className="admin-btn" onClick={() => void approve(user.id)}>
                          Approve
                        </button>
                        <button className="admin-btn reject" onClick={() => void reject(user.id)}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
    </div>
  );
}
