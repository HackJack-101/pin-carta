'use client';

import React, { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction, FormEvent } from 'react';
import { PinStatus, PinStatusLabel, RestaurantPin, type SearchResult } from '@/types';
import { PANEL_PEEK_HEIGHT_PX } from '@/lib/layout';

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
    /**
     * 'sheet'   — mobile bottom sheet with idle/peek/open states (default)
     * 'sidebar' — desktop right sidebar, always shows full content
     */
    variant?: 'sheet' | 'sidebar';
}

const FILTER_VALUES = ['all', 'a-essayer', 'deja-essaye'] as const;

type SheetState = 'idle' | 'peek' | 'open';

function FilterChips({
    filter,
    setFilter,
    shrink,
}: {
    filter: 'all' | PinStatus;
    setFilter: (v: 'all' | PinStatus) => void;
    shrink?: boolean;
}) {
    return (
        <>
            {FILTER_VALUES.map((f) => (
                <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 ${shrink ? 'shrink-0' : ''} ${
                        filter === f
                            ? 'bg-zinc-900 text-white shadow-sm'
                            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
                    }`}
                >
                    {f === 'all' ? 'Tous' : PinStatusLabel[f]}
                </button>
            ))}
        </>
    );
}

function StatusBadge({ status }: { status: PinStatus }) {
    const isEssaye = status === 'deja-essaye';
    return (
        <span
            className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                isEssaye ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
        >
            {PinStatusLabel[status]}
        </span>
    );
}

function PlaceInfo({ draft, selected }: Pick<PanelProps, 'draft' | 'selected'>) {
    return (
        <div className="mb-5 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 text-sm">
            <div className="font-semibold text-zinc-900">{draft.name || selected?.name || '(sans nom)'}</div>
            <div className="mt-1 text-zinc-600">
                {(
                    [draft.address ?? selected?.address, draft.com_nom ?? selected?.com_nom].filter(Boolean) as string[]
                ).join(', ') || 'Adresse non disponible'}
            </div>
            {(draft.opening_hours ?? selected?.opening_hours) && (
                <div className="mt-1 text-xs text-zinc-500">{draft.opening_hours ?? selected?.opening_hours}</div>
            )}
        </div>
    );
}

function EditForm({
    draft,
    setDraft,
    selected,
    removeSelected,
    cancelDraft,
    submitDraft,
    draftTagsString,
    parseTags,
}: Pick<PanelProps, 'draft' | 'setDraft' | 'selected' | 'removeSelected' | 'cancelDraft' | 'submitDraft' | 'draftTagsString' | 'parseTags'>) {
    const draftOsmId = (draft as RestaurantPin).osm_id;
    const isCustom = !selected && !draftOsmId && !!(draft as any).position;
    return (
        <form onSubmit={submitDraft} className="mb-6 space-y-4">
            {isCustom && (
                <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Nom du restaurant</label>
                    <input
                        required
                        autoFocus
                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 caret-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none"
                        placeholder="Nom du restaurant…"
                        value={draft.name || ''}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                    {(draft.address || draft.com_nom) && (
                        <p className="mt-1.5 text-xs text-zinc-500">
                            📍 {[draft.address, draft.com_nom].filter(Boolean).join(', ')}
                        </p>
                    )}
                </div>
            )}
            <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Statut</label>
                <div className="flex gap-2">
                    {(['a-essayer', 'deja-essaye'] as const).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setDraft((d) => ({ ...d, status: s }))}
                            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                                draft.status === s
                                    ? s === 'a-essayer'
                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
                            }`}
                        >
                            {PinStatusLabel[s]}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Tags</label>
                <input
                    className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 caret-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none"
                    placeholder="italien, terrasse, pas cher…"
                    value={draftTagsString}
                    onChange={(e) => setDraft((d) => ({ ...d, tags: parseTags(e.target.value) }))}
                />
            </div>
            <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Notes</label>
                <textarea
                    className="h-24 w-full resize-none rounded-xl border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 caret-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none"
                    placeholder="Vos remarques, plats à tester, prix…"
                    value={draft.notes || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                />
            </div>
            <div className="flex items-center gap-2 pt-1">
                {selected && (
                    <button
                        type="button"
                        onClick={removeSelected}
                        className="shrink-0 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                        Supprimer
                    </button>
                )}
                <button
                    type="button"
                    onClick={cancelDraft}
                    className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={!draft.status || (!selected && !draftOsmId && !(isCustom && draft.name))}
                    className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {selected ? 'Mettre à jour' : 'Enregistrer'}
                </button>
            </div>
        </form>
    );
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
    variant = 'sheet',
}: PanelProps) {
    const [sheetState, setSheetState] = useState<SheetState>('idle');

    const draftOsmId = (draft as RestaurantPin).osm_id;
    const hasPlace = selected || draftOsmId || !!(draft as any).position;
    const placeName = draft.name || selected?.name || '(sans nom)';
    const placeAddress = (
        [draft.address ?? selected?.address, draft.com_nom ?? selected?.com_nom].filter(Boolean) as string[]
    ).join(', ') || 'Adresse non disponible';
    const placeStatus = (draft.status ?? selected?.status) as PinStatus | undefined;

    // Auto-transition sheet state when a place is selected/deselected
    useEffect(() => {
        if (hasPlace) {
            setSheetState((s) => (s === 'idle' ? 'peek' : s));
        } else {
            setSheetState('idle');
        }
    }, [hasPlace]);

    // Nudge Leaflet to recalc size after sheet state change animation
    useEffect(() => {
        if (variant !== 'sheet') return;
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 320);
        return () => clearTimeout(timer);
    }, [sheetState, variant]);

    // ── Sidebar variant: always show full content, no collapsing ──────────────
    if (variant === 'sidebar') {
        return (
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
                    <div className="flex flex-wrap gap-2">
                        <FilterChips filter={filter} setFilter={setFilter} />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {!hasPlace ? (
                        <p className="text-center text-sm text-zinc-500 pt-4">
                            Recherchez un restaurant ou cliquez sur la carte pour ajouter un pin.
                        </p>
                    ) : (
                        <>
                            {(selected || (draft as RestaurantPin).osm_id) && <PlaceInfo draft={draft} selected={selected} />}
                            <EditForm
                                draft={draft}
                                setDraft={setDraft}
                                selected={selected}
                                removeSelected={removeSelected}
                                cancelDraft={cancelDraft}
                                submitDraft={submitDraft}
                                draftTagsString={draftTagsString}
                                parseTags={parseTags}
                            />
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── Sheet variant (mobile bottom sheet) ──────────────────────────────────
    const sheetMaxHeight =
        sheetState === 'open' ? '75vh' : sheetState === 'peek' ? `${PANEL_PEEK_HEIGHT_PX}px` : '4.5rem';

    return (
        <div style={{ maxHeight: sheetMaxHeight }} className="pointer-events-auto w-full overflow-hidden transition-[max-height] duration-300 ease-in-out">
            {/* Drag handle — always visible, toggles peek ↔ open */}
            <button
                type="button"
                className="flex w-full items-center justify-center px-4 pt-3 pb-2"
                onClick={() => {
                    if (sheetState === 'idle') return;
                    setSheetState((s) => (s === 'open' ? 'peek' : 'open'));
                }}
                aria-label={sheetState === 'open' ? 'Réduire le panneau' : 'Agrandir le panneau'}
            >
                <span
                    className={`h-1 w-10 rounded-full transition-colors ${
                        sheetState === 'open' ? 'bg-zinc-400' : 'bg-zinc-300'
                    }`}
                />
            </button>

            {/* Idle state: filter chips */}
            {sheetState === 'idle' && (
                <div className="flex items-center gap-2 overflow-x-auto px-4 pb-[calc(0.75rem+var(--safe-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <FilterChips filter={filter} setFilter={setFilter} shrink />
                </div>
            )}

            {/* Peek state: compact place card */}
            {sheetState === 'peek' && hasPlace && (
                <div className="px-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-zinc-900">{placeName}</p>
                            <p className="truncate text-xs text-zinc-600">{placeAddress}</p>
                        </div>
                        {placeStatus && <StatusBadge status={placeStatus} />}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setSheetState('idle');
                                cancelDraft();
                            }}
                            className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                        >
                            Fermer
                        </button>
                        <button
                            type="button"
                            onClick={() => setSheetState('open')}
                            className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                        >
                            Modifier
                        </button>
                    </div>
                </div>
            )}

            {/* Open state: full edit form */}
            {sheetState === 'open' && (
                <div
                    id="panel-content"
                    className="max-h-[66vh] overflow-y-auto px-5 pb-[calc(1.5rem+var(--safe-bottom))] sm:px-6"
                    role="region"
                    aria-label="Panneau d'édition et de recherche"
                >
                    {!hasPlace ? (
                        <div className="py-2 pb-6">
                            <div className="mb-4 flex flex-wrap gap-2">
                                <FilterChips filter={filter} setFilter={setFilter} />
                            </div>
                            <p className="text-center text-sm text-zinc-500">
                                Recherchez un restaurant ou cliquez sur la carte pour ajouter un pin.
                            </p>
                        </div>
                    ) : (
                        <>
                            {(selected || (draft as RestaurantPin).osm_id) && <PlaceInfo draft={draft} selected={selected} />}
                            <EditForm
                                draft={draft}
                                setDraft={setDraft}
                                selected={selected}
                                removeSelected={removeSelected}
                                cancelDraft={cancelDraft}
                                submitDraft={submitDraft}
                                draftTagsString={draftTagsString}
                                parseTags={parseTags}
                            />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
