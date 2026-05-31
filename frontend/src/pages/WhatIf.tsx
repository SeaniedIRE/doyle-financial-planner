import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface WhatIfRequest {
  name: string;
  description?: string;
  override_sean_tfsa?: number;
  override_saudya_tfsa?: number;
  override_sean_rrsp?: number;
  override_saudya_rrsp?: number;
  override_sean_fhsa?: number;
  override_saudya_fhsa?: number;
  override_sean_margin?: number;
  override_saudya_margin?: number;
  override_sean_base?: number;
  override_saudya_base?: number;
  override_house_purchase_year?: number;
  override_house_down_payment?: number;
  save?: boolean;
}

interface YearResult {
  year: number;
  combined_net_worth: { conservative: number; moderate: number; optimistic: number };
  events: string[];
}

interface SimulateResponse {
  result: YearResult[];
  id?: number;
}

interface SavedSim {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

function fmtCAD(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

const OVERRIDES: { key: keyof WhatIfRequest; label: string; placeholder: string }[] = [
  { key: "override_sean_tfsa", label: "Person A TFSA balance ($)", placeholder: "e.g. 150000" },
  { key: "override_saudya_tfsa", label: "Person B TFSA balance ($)", placeholder: "e.g. 150000" },
  { key: "override_sean_rrsp", label: "Person A RRSP balance ($)", placeholder: "e.g. 200000" },
  { key: "override_saudya_rrsp", label: "Person B RRSP balance ($)", placeholder: "e.g. 100000" },
  { key: "override_sean_fhsa", label: "Person A FHSA balance ($)", placeholder: "e.g. 40000" },
  { key: "override_saudya_fhsa", label: "Person B FHSA balance ($)", placeholder: "e.g. 40000" },
  { key: "override_sean_margin", label: "Person A Margin balance ($)", placeholder: "e.g. 130000" },
  { key: "override_saudya_margin", label: "Person B Margin balance ($)", placeholder: "e.g. 130000" },
  { key: "override_sean_base", label: "Person A Base salary ($)", placeholder: "e.g. 260000" },
  { key: "override_saudya_base", label: "Person B Base salary ($)", placeholder: "e.g. 130000" },
  { key: "override_house_purchase_year", label: "House purchase year", placeholder: "e.g. 2031" },
  { key: "override_house_down_payment", label: "Down payment ($)", placeholder: "e.g. 250000" },
];

export default function WhatIf() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("My What-If");
  const [description, setDescription] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [result, setResult] = useState<YearResult[] | null>(null);
  const [shouldSave, setShouldSave] = useState(false);

  const { data: saved } = useQuery<SavedSim[]>({
    queryKey: ["whatif-saved"],
    queryFn: () => api.get<SavedSim[]>("/whatif/").then((r) => r.data),
  });

  const simulate = useMutation({
    mutationFn: (req: WhatIfRequest) => api.post<SimulateResponse>("/whatif/simulate", req),
    onSuccess: (res) => {
      setResult(res.data.result);
      if (shouldSave) queryClient.invalidateQueries({ queryKey: ["whatif-saved"] });
    },
  });

  const deleteSim = useMutation({
    mutationFn: (id: number) => api.delete(`/whatif/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatif-saved"] }),
  });

  function handleRun() {
    const req: WhatIfRequest = { name, description: description || undefined, save: shouldSave };
    for (const { key } of OVERRIDES) {
      const val = overrides[key];
      if (val !== undefined && val !== "") {
        (req as unknown as Record<string, unknown>)[key] = parseFloat(val);
      }
    }
    simulate.mutate(req);
  }

  const chartData = result?.map((r) => ({
    year: r.year,
    Conservative: Math.round(r.combined_net_worth.conservative),
    Moderate: Math.round(r.combined_net_worth.moderate),
    Optimistic: Math.round(r.combined_net_worth.optimistic),
  }));

  const lastResult = result ? result[result.length - 1] : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">What-If Simulator</h1>
        <p className="text-gray-500 mt-1">
          Override any starting value and see how it changes your 40-year projection.
          Leave fields blank to use current portfolio values.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scenario name</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. What if we put $100K extra into the TFSA?"
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Override values (leave blank to use current)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {OVERRIDES.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={placeholder}
                  value={overrides[key] ?? ""}
                  onChange={(e) => setOverrides((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={shouldSave} onChange={(e) => setShouldSave(e.target.checked)} className="rounded" />
            Save this simulation
          </label>
          <button
            onClick={handleRun}
            disabled={simulate.isPending}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {simulate.isPending ? "Running…" : "Run simulation"}
          </button>
        </div>

        {simulate.isError && (
          <p className="text-red-600 text-sm">Failed to run simulation. Check that your values are valid numbers.</p>
        )}
      </div>

      {result && chartData && lastResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Combined net worth projection (2026–2065)</h2>
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtCAD(v)} />
              <Legend />
              <Line type="monotone" dataKey="Conservative" stroke="#94a3b8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Moderate" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Optimistic" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-4 pt-2">
            {(["conservative", "moderate", "optimistic"] as const).map((s) => (
              <div key={s} className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s} (2065)</div>
                <div className="text-xl font-bold text-gray-900">
                  {fmtCAD(lastResult.combined_net_worth[s])}
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400">
            Conservative = 5% annual growth · Moderate = 7% · Optimistic = 10%
          </div>
        </div>
      )}

      {saved && saved.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved simulations</h2>
          <div className="space-y-2">
            {saved.map((sim) => (
              <div key={sim.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-sm text-gray-900">{sim.name}</div>
                  {sim.description && <div className="text-xs text-gray-500">{sim.description}</div>}
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(sim.created_at).toLocaleDateString("en-CA")}
                  </div>
                </div>
                <button
                  onClick={() => deleteSim.mutate(sim.id)}
                  className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
