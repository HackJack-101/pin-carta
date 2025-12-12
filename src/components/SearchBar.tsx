'use client';

import React from 'react';
import type { SearchResult } from '@/types';

export interface SearchBarProps {
    q: string;
    setQ: (v: string) => void;
    searching: boolean;
    results: SearchResult[];
    setResults: (v: SearchResult[]) => void;
    setFocusAt: (pos: { lat: number; lng: number } | null) => void;
    focusAt?: { lat: number; lng: number } | null;
    onSelectResult?: (r: SearchResult) => void;
}

export default function SearchBar({ q, setQ, searching, results, setResults, setFocusAt, focusAt, onSelectResult }: SearchBarProps) {
    return (
        <div className="fixed left-0 right-0 top-0 z-[1200] flex w-full justify-center px-4 pt-[calc(0.5rem+var(--safe-top))]">
            <div className="w-full max-w-xl">
                <div className="relative">
                    <input
                        className="w-full rounded border border-zinc-300 bg-white/95 p-2 pr-8 text-sm backdrop-blur supports-[backdrop-filter]:bg-white/80"
                        placeholder="Rechercher un endroit"
                        inputMode="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setResults([]);
                                setFocusAt(null);
                            }
                        }}
                    />
                    {(q.length > 0 || searching || results.length > 0 || !!focusAt) && (
                        <button
                            type="button"
                            aria-label="Effacer la recherche"
                            title="Effacer la recherche"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                            onClick={() => {
                                setQ('');
                                setResults([]);
                                setFocusAt(null);
                            }}
                        >
                            <span aria-hidden>×</span>
                        </button>
                    )}
                    {(q.length > 0 || searching || results.length > 0) && (
                        <div className="absolute left-0 right-0 top-full z-[1300] mt-1 max-h-64 overflow-auto rounded border border-zinc-200 bg-white shadow-md">
                            {searching && <div className="p-2 text-xs text-zinc-500">Recherche...</div>}
                            {!searching && results.length === 0 && q && <div className="p-2 text-xs text-zinc-500">Aucun résultat</div>}
                            <ul>
                                {results.map((r) => {
                                    const title = r.name || r.brand || r.operator || '(sans nom)';
                                    const subtitleParts = [r.brand && r.brand !== r.name ? r.brand : null, r.operator, r.type].filter(Boolean) as string[];
                                    return (
                                        <li
                                            key={r.osm_id}
                                            className="cursor-pointer border-t border-zinc-100 p-2 hover:bg-zinc-50"
                                            onClick={() => {
                                                setFocusAt({ lat: r.lat, lng: r.lng });
                                                setResults([]);
                                                if (onSelectResult) onSelectResult(r);
                                            }}
                                        >
                                            <div className="text-sm font-medium">{title}</div>
                                            {subtitleParts.length > 0 && <div className="text-[11px] text-zinc-500">{subtitleParts.join(' · ')}</div>}
                                            <div className="mt-0.5 text-[10px] text-zinc-400">
                                                {[r.address, r.com_insee, r.com_nom].filter(Boolean).join(' · ') || "(pas d'adresse)"}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
