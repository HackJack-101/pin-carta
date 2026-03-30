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
        <div style={{ right: 'var(--sidebar-width)' }} className="fixed left-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-[1200] flex w-full justify-center px-3 pt-3 sm:px-6">
            <div className="w-full max-w-lg">
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </div>
                    <input
                        className="w-full rounded-2xl border border-zinc-200/80 bg-white/95 py-2.5 pl-10 pr-10 text-sm text-zinc-900 caret-zinc-900 shadow-lg shadow-black/5 backdrop-blur-xl transition-shadow focus:border-zinc-300 focus:shadow-lg focus:outline-none supports-[backdrop-filter]:bg-white/85"
                        placeholder="Rechercher un restaurant…"
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
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                            onClick={() => {
                                setQ('');
                                setResults([]);
                                setFocusAt(null);
                            }}
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    {(q.length > 0 || searching || results.length > 0) && (
                        <div className="absolute left-0 right-0 top-full z-[1300] mt-2 max-h-72 overflow-auto rounded-2xl border border-zinc-200/80 bg-white/95 shadow-xl shadow-black/10 backdrop-blur-xl">
                            {searching && (
                                <div className="flex items-center gap-2 p-3 text-xs text-zinc-600">
                                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                                    Recherche…
                                </div>
                            )}
                            {!searching && results.length === 0 && q && (
                                <div className="p-3 text-center text-xs text-zinc-500">Aucun résultat</div>
                            )}
                            <ul aria-label="Suggestions de recherche">
                                {results.map((r, i) => {
                                    const title = r.name || r.brand || r.operator || '(sans nom)';
                                    const subtitleParts = [r.brand && r.brand !== r.name ? r.brand : null, r.operator, r.type].filter(Boolean) as string[];
                                    return (
                                        <li key={r.osm_id} className={i > 0 ? 'border-t border-zinc-100' : ''}>
                                            <button
                                                type="button"
                                                className="w-full cursor-pointer px-3.5 py-3 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100"
                                                onClick={() => {
                                                    setFocusAt({ lat: r.lat, lng: r.lng });
                                                    setResults([]);
                                                    if (onSelectResult) onSelectResult(r);
                                                }}
                                            >
                                                <div className="text-sm font-medium text-zinc-900">{title}</div>
                                                {subtitleParts.length > 0 && (
                                                    <div className="mt-0.5 text-xs text-zinc-600">{subtitleParts.join(' · ')}</div>
                                                )}
                                                <div className="mt-0.5 text-[11px] text-zinc-500">
                                                    {[r.address, r.com_insee, r.com_nom].filter(Boolean).join(' · ') || "(pas d'adresse)"}
                                                </div>
                                            </button>
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
