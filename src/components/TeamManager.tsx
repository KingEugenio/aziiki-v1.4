import React, { useEffect, useState } from "react";
import { Plus, Trash as Trash2, Users } from "@phosphor-icons/react";
import { api, ApiError } from "../lib/api";
import { LoadingSwap } from "./LoadingSwap";
import { SkeletonTable } from "./Skeleton";

interface Membership {
  id: string;
  businessId: string;
  memberUserId: string;
  role: "Admin" | "Accountant" | "Staff";
  invitedEmail: string;
  createdAt: string;
}

interface TeamManagerProps {
  businessId: string;
}

const ROLE_STYLES: Record<Membership["role"], string> = {
  Admin: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Accountant: "bg-amber-50 text-amber-700 border-amber-200",
  Staff: "bg-slate-100 text-slate-600 border-slate-200",
};

const ROLE_OPTIONS: { value: Membership["role"]; label: string }[] = [
  { value: "Admin", label: "Admin — full control except deleting the business" },
  { value: "Accountant", label: "Accountant — full CRUD, can't manage the team" },
  { value: "Staff", label: "Staff — can create/edit but not delete records" },
];

/**
 * Self-fetching, following the same pattern as PurchaseOrderManager/
 * BrandKitSettings: calls the real /api/business-memberships routes
 * directly. Permission enforcement (who can invite/change roles/remove) is
 * real - done server-side by Postgres RLS - not re-implemented here; errors
 * from an unauthorized action (e.g. a Staff member trying to invite) surface
 * as the plain error message the backend returns.
 */
export default function TeamManager({ businessId }: TeamManagerProps) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Membership["role"]>("Staff");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.businessMemberships
      .list(businessId)
      .then((data) => {
        if (!cancelled) setMembers(data as Membership[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load your team.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter an email address.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const created = await api.businessMemberships.invite({ businessId, email: email.trim(), role });
      setMembers((prev) => [...prev, created as Membership]);
      setEmail("");
      setRole("Staff");
      setIsInviting(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to invite this team member.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: Membership["role"]) => {
    setError(null);
    try {
      const updated = await api.businessMemberships.updateRole(id, newRole);
      setMembers((prev) => prev.map((m) => (m.id === id ? (updated as Membership) : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update this member's role.");
    }
  };

  const handleRemove = async (id: string) => {
    setError(null);
    try {
      await api.businessMemberships.remove(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove this team member.");
    }
  };

  return (
    <div id="team-manager-root" className="space-y-4 text-slate-800 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            Team
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Invite people to help run this business. You keep full control as owner.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsInviting((v) => !v)}
          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-750 flex items-center gap-1 cursor-pointer bg-slate-50 border border-slate-200 hover:border-slate-300 px-2 py-1 rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" /> Invite
        </button>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs">{error}</div>}

      {isInviting && (
        <form onSubmit={handleInvite} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
          <div>
            <label htmlFor="team-invite-email" className="text-[9px] font-mono font-bold text-slate-450 block">
              Email
            </label>
            <input
              id="team-invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none"
            />
          </div>
          <div>
            <label htmlFor="team-invite-role" className="text-[9px] font-mono font-bold text-slate-450 block">
              Role
            </label>
            <select
              id="team-invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Membership["role"])}
              className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-2.5 rounded-lg text-white font-semibold uppercase tracking-wider text-[10px] cursor-pointer"
          >
            {isSaving ? "Sending invite..." : "Send Invite"}
          </button>
        </form>
      )}

      <LoadingSwap isLoading={isLoading} skeleton={<SkeletonTable rows={3} cols={3} />}>
        <div className="space-y-2">
          {members.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic text-xs">
              No team members yet. Click "Invite" to bring someone onto this business.
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="border border-slate-200 rounded-xl p-3.5 bg-white flex items-center justify-between text-xs gap-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{member.invitedEmail}</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">
                    Invited {new Date(member.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label={`Change role for ${member.invitedEmail}`}
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as Membership["role"])}
                    className={`text-[9px] font-bold px-2 py-1.5 rounded-lg border cursor-pointer ${ROLE_STYLES[member.role]}`}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Staff">Staff</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemove(member.id)}
                    aria-label={`Remove ${member.invitedEmail}`}
                    className="w-7 h-7 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-rose-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </LoadingSwap>
    </div>
  );
}
