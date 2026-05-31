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
  return { name: "", role: "adult", date_of_birth: "", canada_resident_since_year: "", province: "ON", parent_id: "" };
}

function age(dob?: string): string {
  if (!dob) return "—";
  const d = new Date(dob);
  const now = new Date();
  const a = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  return `${a} yrs`;
}

export default function FamilyMembers() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PersonFormState>(emptyForm());

  const { data: persons } = useQuery<Person[]>({
    queryKey: ["persons"],
    queryFn: () => api.get<Person[]>("/persons/").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/persons/", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["persons"] }); setShowForm(false); setForm(emptyForm()); },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => api.put(`/persons/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["persons"] }); setEditId(null); },
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
      canada_resident_since_year: f.canada_resident_since_year ? parseInt(f.canada_resident_since_year) : undefined,
      province: f.province,
      parent_id: f.parent_id ? parseInt(f.parent_id) : undefined,
    };
  }

  function startEdit(p: Person) {
    setEditId(p.id);
    setForm({
      name: p.name,
      role: p.role,
      date_of_birth: p.date_of_birth ?? "",
      canada_resident_since_year: p.canada_resident_since_year?.toString() ?? "",
      province: p.province,
      parent_id: p.parent_id?.toString() ?? "",
    });
  }

  const adults = persons?.filter((p) => p.role === "adult") ?? [];
  const children = persons?.filter((p) => p.role === "child") ?? [];

  const FormBlock = () => (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">{editId ? "Edit member" : "Add family member"}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "adult" | "child" }))}>
            <option value="adult">Adult</option>
            <option value="child">Child</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date of birth</label>
          <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.date_of_birth} onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Canada resident since (year)</label>
          <input type="number" placeholder="e.g. 2018" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.canada_resident_since_year} onChange={(e) => setForm((p) => ({ ...p, canada_resident_since_year: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Province</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.province} onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}>
            {["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"].map((prov) => (
              <option key={prov} value={prov}>{prov}</option>
            ))}
          </select>
        </div>
        {form.role === "child" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Parent (optional)</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.parent_id} onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value }))}>
              <option value="">— none —</option>
              {adults.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => editId ? update.mutate({ id: editId, data: buildPayload(form) }) : create.mutate(buildPayload(form))}
          disabled={!form.name || create.isPending || update.isPending}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {editId ? "Save changes" : "Add member"}
        </button>
        <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm()); }} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );

  const PersonCard = ({ p }: { p: Person }) => {
    const parent = persons?.find((x) => x.id === p.parent_id);
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-gray-900">{p.name}</div>
            <div className="text-sm text-gray-500 mt-0.5 capitalize">{p.role}</div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.role === "adult" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>
            {p.role}
          </span>
        </div>
        <div className="mt-3 space-y-1 text-sm text-gray-600">
          <div><span className="text-gray-400">Age:</span> {age(p.date_of_birth)}</div>
          <div><span className="text-gray-400">Province:</span> {p.province}</div>
          {p.canada_resident_since_year && <div><span className="text-gray-400">Canadian resident since:</span> {p.canada_resident_since_year}</div>}
          {parent && <div><span className="text-gray-400">Parent:</span> {parent.name}</div>}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => { startEdit(p); setShowForm(false); }} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium transition-colors">Edit</button>
          <button onClick={() => remove.mutate(p.id)} className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors">Remove</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Family Members</h1>
          <p className="text-gray-500 mt-1">Manage the people in your financial plan. Add children over time.</p>
        </div>
        {!showForm && !editId && (
          <button onClick={() => { setShowForm(true); setEditId(null); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            + Add member
          </button>
        )}
      </div>

      {(showForm || editId) && <FormBlock />}

      {adults.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Adults</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adults.map((p) => <PersonCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {children.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Children</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((p) => <PersonCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {(!persons || persons.length === 0) && !showForm && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <div className="text-gray-400 text-4xl mb-3">👨‍👩‍👧</div>
          <p className="text-gray-600 font-medium">No family members yet</p>
          <p className="text-gray-400 text-sm mt-1">Click "Add member" to get started.</p>
        </div>
      )}
    </div>
  );
}
