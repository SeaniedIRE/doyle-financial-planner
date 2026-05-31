import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";

interface Person {
  id: number;
  name: string;
  role: "adult" | "child";
  date_of_birth?: string;
  canada_resident_since_year?: number;
  province: string;
  parent_id?: number;
}

interface PersonFormState {
  name: string;
  role: "adult" | "child";
  date_of_birth: string;
  canada_resident_since_year: string;
  province: string;
  parent_id: string;
}

function emptyForm(): PersonFormState {
  return {
    name: "",
    role: "adult",
    date_of_birth: "",
    canada_resident_since_year: "",
    province: "ON",
    parent_id: "",
  };
}

function age(dob?: string): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const a =
    now.getFullYear() -
    d.getFullYear() -
    (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  return `${a} yrs`;
}

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

// ─── PersonCard — defined OUTSIDE the page so React doesn't remount it ────────

interface PersonCardProps {
  p: Person;
  persons: Person[];
  onEdit: (p: Person) => void;
  onRemove: (id: number) => void;
}

function PersonCard({ p, persons, onEdit, onRemove }: PersonCardProps) {
  const parent = persons.find((x) => x.id === p.parent_id);
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-slate-100 text-base">{p.name}</div>
          <div className="text-xs text-slate-500 mt-0.5 capitalize">{p.role}</div>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            p.role === "adult"
              ? "bg-blue-900/50 text-blue-300 border border-blue-700/40"
              : "bg-emerald-900/50 text-emerald-300 border border-emerald-700/40"
          }`}
        >
          {p.role}
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex gap-2">
          <span className="text-slate-500 w-32 shrink-0">Age</span>
          <span className="text-slate-300">{age(p.date_of_birth)}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-slate-500 w-32 shrink-0">Province</span>
          <span className="text-slate-300">{p.province}</span>
        </div>
        {p.canada_resident_since_year && (
          <div className="flex gap-2">
            <span className="text-slate-500 w-32 shrink-0">Resident since</span>
            <span className="text-slate-300">{p.canada_resident_since_year}</span>
          </div>
        )}
        {parent && (
          <div className="flex gap-2">
            <span className="text-slate-500 w-32 shrink-0">Parent</span>
            <span className="text-slate-300">{parent.name}</span>
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-3 border-t border-slate-800 pt-3">
        <button
          onClick={() => onEdit(p)}
          className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onRemove(p.id)}
          className="text-red-500 hover:text-red-400 text-xs font-medium transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FamilyMembers() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PersonFormState>(emptyForm());

  const { data: persons = [] } = useQuery<Person[]>({
    queryKey: ["persons"],
    queryFn: () => api.get<Person[]>("/persons/").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/persons/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
      setShowForm(false);
      setForm(emptyForm());
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put(`/persons/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
      setEditId(null);
      setForm(emptyForm());
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/persons/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["persons"] }),
  });

  function buildPayload(f: PersonFormState): Record<string, unknown> {
    return {
      name: f.name,
      role: f.role,
      date_of_birth: f.date_of_birth || undefined,
      canada_resident_since_year: f.canada_resident_since_year
        ? parseInt(f.canada_resident_since_year)
        : undefined,
      province: f.province,
      parent_id: f.parent_id ? parseInt(f.parent_id) : undefined,
    };
  }

  function startEdit(p: Person) {
    setEditId(p.id);
    setShowForm(false);
    setForm({
      name: p.name,
      role: p.role,
      date_of_birth: p.date_of_birth ?? "",
      canada_resident_since_year: p.canada_resident_since_year?.toString() ?? "",
      province: p.province,
      parent_id: p.parent_id?.toString() ?? "",
    });
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm());
  }

  const adults   = persons.filter((p) => p.role === "adult");
  const children = persons.filter((p) => p.role === "child");
  const showingForm = showForm || editId !== null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Family Members</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage the people in your financial plan. Add children over time.
          </p>
        </div>
        {!showingForm && (
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm()); }}
            className="btn-primary"
          >
            + Add member
          </button>
        )}
      </div>

      {/* ── Form — inlined (NOT a sub-component) to prevent focus loss on every keystroke ── */}
      {showingForm && (
        <div className="card mb-6 space-y-4">
          <h3 className="font-semibold text-slate-200">
            {editId !== null ? "Edit member" : "Add family member"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Name */}
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                placeholder="e.g. Jane Doe"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* Role */}
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) =>
                  setForm((p) => ({ ...p, role: e.target.value as "adult" | "child" }))
                }
              >
                <option value="adult">Adult</option>
                <option value="child">Child</option>
              </select>
            </div>

            {/* Date of birth */}
            <div>
              <label className="label">Date of birth</label>
              <input
                type="date"
                className="input"
                value={form.date_of_birth}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date_of_birth: e.target.value }))
                }
              />
            </div>

            {/* Canada resident since */}
            <div>
              <label className="label">Canada resident since (year)</label>
              <input
                type="number"
                className="input"
                placeholder="e.g. 2018"
                value={form.canada_resident_since_year}
                onChange={(e) =>
                  setForm((p) => ({ ...p, canada_resident_since_year: e.target.value }))
                }
              />
            </div>

            {/* Province */}
            <div>
              <label className="label">Province</label>
              <select
                className="input"
                value={form.province}
                onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
              >
                {PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            </div>

            {/* Parent (children only) */}
            {form.role === "child" && (
              <div>
                <label className="label">Parent (optional)</label>
                <select
                  className="input"
                  value={form.parent_id}
                  onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value }))}
                >
                  <option value="">— none —</option>
                  {adults.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() =>
                editId !== null
                  ? update.mutate({ id: editId, data: buildPayload(form) })
                  : create.mutate(buildPayload(form))
              }
              disabled={!form.name || create.isPending || update.isPending}
              className="btn-primary"
            >
              {editId !== null ? "Save changes" : "Add member"}
            </button>
            <button onClick={cancelForm} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Adults ── */}
      {adults.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Adults
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adults.map((p) => (
              <PersonCard
                key={p.id}
                p={p}
                persons={persons}
                onEdit={startEdit}
                onRemove={(id) => remove.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Children ── */}
      {children.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Children
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((p) => (
              <PersonCard
                key={p.id}
                p={p}
                persons={persons}
                onEdit={startEdit}
                onRemove={(id) => remove.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {persons.length === 0 && !showingForm && (
        <div className="card border-dashed border-slate-700 text-center py-14">
          <div className="text-4xl mb-3">👨‍👩‍👧</div>
          <p className="text-slate-300 font-medium">No family members yet</p>
          <p className="text-slate-500 text-sm mt-1">Click "Add member" to get started.</p>
        </div>
      )}
    </div>
  );
}
