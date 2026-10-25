"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Code2,
  Globe,
  MessageSquareText,
  Network,
  Search,
  Sparkles,
} from "lucide-react";

const modes = [
  { id: "search", label: "Search Web", icon: Search },
  { id: "scrape", label: "Scrape", icon: Code2 },
  { id: "answer", label: "Answer", icon: MessageSquareText },
  { id: "map", label: "Map", icon: Network },
  { id: "brand", label: "Brand", icon: Sparkles },
] as const;

type Mode = (typeof modes)[number]["id"];

export function SearchBar() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    router.push(
      value
        ? `/dashboard?mode=${mode}&q=${encodeURIComponent(value)}`
        : "/dashboard",
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl rounded-[32px] bg-white p-2 shadow-[0_18px_60px_-20px_rgba(37,99,235,0.45)]">
      <div className="rounded-[26px] bg-[#2f6bff] bg-[radial-gradient(circle,rgba(255,255,255,0.9)_1.5px,transparent_1.6px)] bg-[size:24px_24px] p-3 sm:p-4">
        <div className="rounded-[20px] border border-black/5 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[14px] bg-[#f1f2f4] p-1.5 w-fit">
            {modes.map(({ id, label, icon: Icon }) => {
              const active = id === mode;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-[11px] px-3 py-2 text-sm transition sm:px-4 ${
                    active
                      ? "bg-white font-medium text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-[#2f6bff]" : "text-neutral-400"}`}
                  />
                  {label}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-3 flex items-center gap-3 px-1 sm:gap-4 sm:px-2"
          >
            <Globe className="h-5 w-5 shrink-0 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="open source vector databases"
              className="min-w-0 flex-1 bg-transparent py-3 font-mono text-base text-neutral-800 placeholder:text-neutral-400 focus:outline-none sm:text-lg"
            />
            <button
              type="submit"
              aria-label="Run search"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#2f6bff] text-white transition hover:bg-[#245ae0] sm:h-12 sm:w-12"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
