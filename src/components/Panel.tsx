'use client';

import React, { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction, FormEvent } from 'react';
import { PinStatus, PinStatusLabel, RestaurantPin, type SearchResult } from '@/types';

export interface PanelProps {
    q: string;
    setQ: (v: string) => void;
    searching: boolean;
    results: SearchResult[];
    setResults: (v: SearchResult[]) => void;
    filter: 'all' | PinStatus;
    setFilter: (v: 'all' | PinStatus) => void;
    draft: Partial<RestaurantPin> & { position?: { lat: number; lng: number } };
    setDraft: Dispatch<SetStateAction<Partial<RestaurantPin> & { position?: { lat: number; lng: number } }>>;
    selected: RestaurantPin | null;
    removeSelected: () => void;
    cancelDraft: () => void;
    submitDraft: (e: FormEvent) => void;
    draftTagsString: string;
    parseTags: (s: string) => string[];
    filteredPins: RestaurantPin[];
    onMarkerClick: (p: RestaurantPin) => void;
    setFocusAt: (pos: { lat: number; lng: number } | null) => void;
}

export default function Panel({
    q,
    setQ,
    searching,
    results,
    setResults,
    filter,
    setFilter,
    draft,
    setDraft,
    selected,
    removeSelected,
    cancelDraft,
    submitDraft,
    draftTagsString,
    parseTags,
    filteredPins,
    onMarkerClick,
    setFocusAt,
}: PanelProps) {
    const [open, setOpen] = useState(false);

    // Open the panel automatically when a marker is selected or a place is chosen from search
    useEffect(() => {
        if (selected || (draft as any).osm_id) setOpen(true);
    }, [selected, (draft as any).osm_id]);

    // Nudge Leaflet to recalc size after panel open/close animation
    useEffect(() => {
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 320);
        return () => clearTimeout(timer);
    }, [open]);

    return (
        <div className={`pointer-events-auto w-full transition-[max-height] duration-300 ${open ? 'max-h-[72vh]' : 'max-h-14'}`}>
            {/* Grab handle + header */}
            <button className="flex w-full items-center justify-between gap-3 px-4 pt-2 pb-2" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="panel-content">
                <span className="mx-auto flex items-center gap-3">
                    <span className="h-1.5 w-10 rounded-full bg-zinc-300" />
                </span>
            </button>

            {/* Content */}
            {open && (
                <div
                    id="panel-content"
                    className="max-h-[64vh] overflow-y-auto px-4 pb-[calc(1rem+var(--safe-bottom))]"
                    role="region"
                    aria-label="Panneau d'édition et de recherche"
                >
                    {/* Place info (read-only) */}
                    <div className="mb-4 space-y-1 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
                        <div>
                            <span className="text-xs text-zinc-600">Nom</span>
                            <div className="font-medium">{draft.name || selected?.name || '(sans nom)'}</div>
                        </div>
                        <div>
                            <span className="text-xs text-zinc-600">Adresse complète</span>
                            <div className="text-zinc-700">
                                {(
                                    [draft.address ?? selected?.address, draft.com_insee ?? selected?.com_insee, draft.com_nom ?? selected?.com_nom].filter(Boolean) as string[]
                                ).join(' · ') || 'Non disponible'}
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-zinc-600">Horaires d&#39;ouverture</span>
                            <div className="text-zinc-700">{(draft.opening_hours ?? selected?.opening_hours) || 'Non disponible'}</div>
                        </div>
                    </div>

                    {/* Form (user data) */}
                    <form onSubmit={submitDraft} className="mb-6 space-y-3">
                        <div>
                            <label className="mb-1 block text-xs text-zinc-600">Statut</label>
                            <select
                                className="w-full rounded border border-zinc-300 p-2 text-sm"
                                value={draft.status || 'a-essayer'}
                                onChange={(e) =>
                                    setDraft((d) => ({
                                        ...d,
                                        status: e.target.value as PinStatus,
                                    }))
                                }
                            >
                                <option value="a-essayer">à essayer</option>
                                <option value="deja-essaye">déjà essayé</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-zinc-600">Tags (séparés par des virgules)</label>
                            <input
                                className="w-full rounded border border-zinc-300 p-2 text-sm"
                                placeholder="ex: italien, terrasse, pas cher"
                                value={draftTagsString}
                                onChange={(e) => setDraft((d) => ({ ...d, tags: parseTags(e.target.value) }))}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-zinc-600">Notes</label>
                            <textarea
                                className="h-24 w-full rounded border border-zinc-300 p-2 text-sm"
                                placeholder="Vos remarques, plats à tester, prix, etc."
                                value={draft.notes || ''}
                                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-zinc-500">
                                {draft.position ? (
                                    <span>
                                        Position: {draft.position.lat.toFixed(5)}, {draft.position.lng.toFixed(5)}
                                    </span>
                                ) : (
                                    <span>Position inconnue</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {selected && (
                                    <button type="button" onClick={removeSelected} className="rounded border border-red-200 px-3 py-2 text-sm text-red-700">
                                        Supprimer
                                    </button>
                                )}
                                <button type="button" onClick={cancelDraft} className="rounded border border-zinc-200 px-3 py-2 text-sm">
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={!draft.status || (!selected && !draft.osm_id)}
                                    className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {selected ? 'Mettre à jour' : 'Enregistrer'}
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* List */}
                    <div>
                        <h2 className="mb-2 text-sm font-medium text-zinc-700">Mes restaurants</h2>
                        <ul className="flex max-h-64 flex-col gap-2 overflow-auto pr-1">
                            {filteredPins.map((p) => (
                                <li key={p.id} className="cursor-pointer rounded border border-zinc-200 p-2 hover:bg-zinc-50" onClick={() => onMarkerClick(p)}>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">{p.name}</span>
                                        <span className="text-xs text-zinc-500">{PinStatusLabel[p.status]}</span>
                                    </div>
                                    {p.tags?.length ? (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {p.tags.map((t) => (
                                                <span key={t} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                </li>
                            ))}
                            {!filteredPins.length && <li className="text-sm text-zinc-500">Aucun pin pour ce filtre.</li>}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
