import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";

interface Trust {
  id: number;
  name: string;
  trust_type: string;
  settled_date?: string;
  total_market_value_cad: number;
  asset_count: number;
}

interface TrustDetail {
  id: number;
  name: string;
  trust_type: string;
  settled_date?: string;
  trustee_names?: string;
  beneficiary_names?: string;
  province: string;
  notes?: string;
  assets: TrustAsset[];
}

interface TrustAsset {
  id: number;
  asset_type: string;
  name: string;
  symbol?: string;
  quantity?: number;
  book_value_cad: number;
  market_value_cad: number;
  acb_per_unit_cad?: number;
  notes?: string;
}

interface TrustFormData {
  name: string;
  trust_type: string;
  province: string;
  notes: string;
  trustee_names: string;
  beneficiary_names: string;
}

interface AssetFormData {
  asset_type: string;
  name: string;
  symbol: string;
  quantity: string;
  book_value_cad: string;
  market_value_cad: string;
  notes: string;
}

function fmtCAD(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

function TrustForm({ onSubmit, onCancel }: { onSubmit: (d: TrustFormData) => void; onCancel: () => void }) {
  const [form, setForm] = useState<TrustFormData>({ name: "", trust_type: "discretionary", province: "ON", notes: "", trustee_names: "", beneficiary_names: "" });
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 space-y-4">
      <h3 className="font-semibold text-gray-900">New family trust</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["name", "trustee_names", "beneficiary_names", "notes"] as const).map((key) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{key.replace("_", " ")}</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Trust type</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.trust_type}
            onChange={(e) => setForm((p) => ({ ...p, trust_type: e.target.value }))}
          >
            <option value="discretionary">Discretionary</option>
            <option value="alter_ego">Alter Ego</option>
            <option value="spousal">Spousal</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => onSubmit(form)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          Create trust
        </button>
        <button onClick={onCancel} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddAssetForm({ trustId, onDone }: { trustId: number; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AssetFormData>({ asset_type: "security", name: "", symbol: "", quantity: "", book_value_cad: "", market_value_cad: "", notes: "" });
  const add = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post(`/trusts/${trustId}/assets`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trust", trustId] }); onDone(); },
  });
  function submit() {
    add.mutate({
      ...form,
      quantity: form.quantity ? parseFloat(form.quantity) : undefined,
      book_value_cad: parseFloat(form.book_value_cad) || 0,
      market_value_cad: parseFloat(form.market_value_cad) || 0,
    });
  }
  const fields: { k: keyof AssetFormData; l: string }[] = [
    { k: "name", l: "Name" }, { k: "symbol", l: "Ticker (opt.)" },
    { k: "quantity", l: "Units" }, { k: "book_value_cad", l: "Book value ($)" },
    { k: "market_value_cad", l: "Market value ($)" }, { k: "notes", l: "Notes" },
  ];
  return (
    <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Add asset</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={form.asset_type} onChange={(e) => setForm((p) => ({ ...p, asset_type: e.target.value }))}>
            <option value="cash">Cash</option>
            <option value="security">Security / ETF</option>
            <option value="real_estate">Real estate</option>
            <option value="other">Other</option>
          </select>
        </div>
        {fields.map(({ k, l }) => (
          <div key={k}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
            <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={form[k]} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={add.isPending} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">Add</button>
        <button onClick={onDone} className="border border-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

export default function TrustAccounts() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addingAsset, setAddingAsset] = useState(false);

  const { data: trusts } = useQuery<Trust[]>({
    queryKey: ["trusts"],
    queryFn: () => api.get<Trust[]>("/trusts/").then((r) => r.data),
  });

  const { data: detail } = useQuery<TrustDetail>({
    queryKey: ["trust", selectedId],
    queryFn: () => api.get<TrustDetail>(`/trusts/${selectedId}`).then((r) => r.data),
    enabled: selectedId !== null,
  });

  const createTrust = useMutation({
    mutationFn: (data: TrustFormData) => api.post("/trusts/", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trusts"] }); setShowForm(false); },
  });

  const deleteTrust = useMutation({
    mutationFn: (id: number) => api.delete(`/trusts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trusts"] }); setSelectedId(null); },
  });

  const deleteAsset = useMutation({
    mutationFn: ({ trustId, assetId }: { trustId: number; assetId: number }) =>
      api.delete(`/trusts/${trustId}/assets/${assetId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trust", selectedId] }),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Family Trusts</h1>
          <p className="text-gray-500 mt-1">Track assets held inside family trust structures.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          + New trust
        </button>
      </div>

      {showForm && <TrustForm onSubmit={(d) => createTrust.mutate(d)} onCancel={() => setShowForm(false)} />}

      {(!trusts || trusts.length === 0) && !showForm && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <div className="text-gray-400 text-4xl mb-3">🏛</div>
          <p className="text-gray-600 font-medium">No family trusts yet</p>
          <p className="text-gray-400 text-sm mt-1">Click "New trust" to set one up.</p>
        </div>
      )}

      {trusts && trusts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trusts.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
              className={`text-left bg-white rounded-xl border p-5 hover:border-indigo-300 transition-colors ${t.id === selectedId ? "border-indigo-500 ring-1 ring-indigo-200" : "border-gray-200"}`}
            >
              <div className="font-semibold text-gray-900">{t.name}</div>
              <div className="text-xs text-gray-500 mt-0.5 capitalize">{t.trust_type.replace("_", " ")} trust</div>
              <div className="mt-3 flex justify-between items-end">
                <div>
                  <div className="text-xs text-gray-400">Total market value</div>
                  <div className="text-lg font-bold text-gray-900">{fmtCAD(t.total_market_value_cad)}</div>
                </div>
                <div className="text-xs text-gray-400">{t.asset_count} asset{t.asset_count !== 1 ? "s" : ""}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{detail.name}</h2>
              <div className="text-sm text-gray-500 mt-0.5">
                {detail.trustee_names && <span>Trustees: {detail.trustee_names} · </span>}
                {detail.beneficiary_names && <span>Beneficiaries: {detail.beneficiary_names}</span>}
              </div>
            </div>
            <button onClick={() => deleteTrust.mutate(detail.id)} className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors">
              Delete trust
            </button>
          </div>

          {detail.assets.length === 0 ? (
            <p className="text-gray-400 text-sm">No assets yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="text-left pb-2">Asset</th>
                  <th className="text-right pb-2">Book</th>
                  <th className="text-right pb-2">Market</th>
                  <th className="text-right pb-2">Gain/Loss</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {detail.assets.map((a) => {
                  const gl = a.market_value_cad - a.book_value_cad;
                  return (
                    <tr key={a.id}>
                      <td className="py-2">
                        <div className="font-medium text-gray-900">{a.name}</div>
                        <div className="text-xs text-gray-400">{a.symbol ?? a.asset_type}</div>
                      </td>
                      <td className="text-right py-2 text-gray-700">{fmtCAD(a.book_value_cad)}</td>
                      <td className="text-right py-2 text-gray-700">{fmtCAD(a.market_value_cad)}</td>
                      <td className={`text-right py-2 font-medium ${gl >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtCAD(gl)}</td>
                      <td className="text-right py-2">
                        <button onClick={() => deleteAsset.mutate({ trustId: detail.id, assetId: a.id })} className="text-red-400 hover:text-red-600 text-xs transition-colors">Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {addingAsset ? (
            <AddAssetForm trustId={detail.id} onDone={() => setAddingAsset(false)} />
          ) : (
            <button onClick={() => setAddingAsset(true)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors">
              + Add asset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
