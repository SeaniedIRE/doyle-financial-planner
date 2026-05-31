import { useQuery } from "@tanstack/react-query";
import api from "../../api/client";

interface CRALink {
  label: string;
  url: string;
  section: string;
}

interface Props {
  filter?: string[];
  compact?: boolean;
}

export default function CRALinks({ filter, compact = false }: Props) {
  const { data: links } = useQuery<CRALink[]>({
    queryKey: ["cra-links"],
    queryFn: () => api.get<CRALink[]>("/taxcheck/cra-links").then((r) => r.data),
    staleTime: Infinity,
  });

  const visible = links
    ? filter
      ? links.filter((l) => filter.includes(l.section))
      : links
    : [];

  if (visible.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {visible.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800 underline transition-colors"
          >
            {l.section}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">CRA References</div>
      <ul className="space-y-2">
        {visible.map((l) => (
          <li key={l.url} className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">→</span>
            <div>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:text-indigo-800 underline transition-colors"
              >
                {l.label}
              </a>
              <div className="text-xs text-gray-400">{l.section}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
