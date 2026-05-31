import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../api/client";

interface TaxCheckStatus {
  tax_year: number;
  fully_verified: boolean;
  tfsa_limit_verified: boolean;
  rrsp_limit_verified: boolean;
  federal_brackets_verified: boolean;
  ontario_brackets_verified: boolean;
}

export default function TaxYearBanner() {
  const year = new Date().getFullYear();
  const queryClient = useQueryClient();

  const { data } = useQuery<TaxCheckStatus>({
    queryKey: ["taxcheck-current"],
    queryFn: () => api.get<TaxCheckStatus>("/taxcheck/").then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  });

  const confirm = useMutation({
    mutationFn: () =>
      api.post(`/taxcheck/${year}/confirm`, {
        confirmed_by: "User",
        tfsa_limit_verified: true,
        rrsp_limit_verified: true,
        federal_brackets_verified: true,
        ontario_brackets_verified: true,
        notes: `Verified via app banner on ${new Date().toISOString().slice(0, 10)}`,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["taxcheck-current"] }),
  });

  if (!data || data.fully_verified) return null;

  const checks = [
    { key: "tfsa_limit_verified" as const, label: `TFSA ${year} limit` },
    { key: "rrsp_limit_verified" as const, label: `RRSP ${year} cap` },
    { key: "federal_brackets_verified" as const, label: "Federal brackets" },
    { key: "ontario_brackets_verified" as const, label: "Ontario brackets" },
  ];

  const missing = checks.filter(({ key }) => !data[key]).map(({ label }) => label);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4">
      <div className="text-amber-500 text-xl mt-0.5">⚠️</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-amber-800 text-sm">
          {year} CRA rules not yet verified
        </div>
        <div className="text-amber-700 text-xs mt-1">
          Please check the CRA website and confirm these are still accurate for {year}:{" "}
          <span className="font-medium">{missing.join(", ")}</span>.
        </div>
        <a
          href="https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-600 underline hover:text-amber-800 mt-1 inline-block"
        >
          CRA income tax rates →
        </a>
      </div>
      <button
        onClick={() => confirm.mutate()}
        disabled={confirm.isPending}
        className="shrink-0 bg-amber-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
      >
        {confirm.isPending ? "Saving…" : `Confirm ${year} rules`}
      </button>
    </div>
  );
}
