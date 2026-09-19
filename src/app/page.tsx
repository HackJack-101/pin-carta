'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

import MapView from '@/components/MapView';
import NavBar from '@/components/NavBar';
import type { ViewType } from '@/components/NavBar';
import Panel from '@/components/Panel';
import SavedAddresses from '@/components/SavedAddresses';
import SearchBar from '@/components/SearchBar';
import { PinStatus, RestaurantPin, type SearchResult } from '@/types';
import { listUserPins, createUserPin, createCustomPin, updateUserPin, deleteUserPin } from '@/lib/userPins';
import { ApiError } from '@/lib/apiError';
import { PANEL_PEEK_HEIGHT_PX, DESKTOP_SIDEBAR_WIDTH_PX } from '@/lib/layout';

const PARIS_CENTER = { lat: 48.8566, lng: 2.3522 } as const;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const la1 = (a.lat * Math.PI) / 180;
    const la2 = (b.lat * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
const LOC_KEY = 'pin-carta:loc:v1' as const;

export default function Home() {
    const { status } = useSession();
    const [pins, setPins] = useState<RestaurantPin[]>([]);
    const [selected, setSelected] = useState<RestaurantPin | null>(null);
    const [draft, setDraft] = useState<Partial<RestaurantPin> & { position?: { lat: number; lng: number } }>({});
    const [filter, setFilter] = useState<'all' | PinStatus>('all');
    const [view, setView] = useState<ViewType>('map');

    // Location (current geolocation) with persistence
    const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number }>(PARIS_CENTER);

    // Search UI state
    const [q, setQ] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [focusAt, setFocusAt] = useState<{ lat: number; lng: number } | null>(null);

    // Center used for proximity sorting (updates when user moves the map)
    const [sortCenter, setSortCenter] = useState<{ lat: number; lng: number }>(PARIS_CENTER);
    const userMovedRef = useRef(false);

    useEffect(() => {
        if (status !== 'authenticated') {
            setPins([]);
            return;
        }
        (async () => {
            try {
                const data = await listUserPins();
                setPins(data);
            } catch (e) {
                console.warn('Failed to load user pins', e);
            }
        })();
    }, [status]);

    // Load saved location and request geolocation
    useEffect(() => {
        try {
            const raw = localStorage.getItem(LOC_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                    setCurrentLoc({ lat: parsed.lat, lng: parsed.lng });
                }
            }
        } catch {}

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setCurrentLoc(loc);
                    try {
                        localStorage.setItem(LOC_KEY, JSON.stringify(loc));
                    } catch {}
                },
                () => {
                    // Only overwrite with Paris if there is no previously cached location
                    if (!localStorage.getItem(LOC_KEY)) {
                        setCurrentLoc({ ...PARIS_CENTER });
                        try { localStorage.setItem(LOC_KEY, JSON.stringify(PARIS_CENTER)); } catch {}
                    }
                },
                { enableHighAccuracy: true, maximumAge: 60000, timeout: 5000 },
            );
        } else {
            // No geolocation API: persist Paris
            try {
                localStorage.setItem(LOC_KEY, JSON.stringify(PARIS_CENTER));
            } catch {}
            setCurrentLoc({ ...PARIS_CENTER });
        }
    }, []);

    // Keep sortCenter in sync with currentLoc until user pans the map
    useEffect(() => {
        if (!userMovedRef.current) {
            setSortCenter(currentLoc);
        }
    }, [currentLoc.lat, currentLoc.lng]);

    // Debounced search effect
    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;

        async function run() {
            const query = q.trim();
            if (!query) {
                setResults([]);
                setSearching(false);
                return;
            }
            setSearching(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=25`, { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as { results: SearchResult[] };
                const base = data.results || [];
                // Sort by proximity to current map center (or geolocation before any move)
                const here = sortCenter || currentLoc || PARIS_CENTER;
                const sorted = [...base].sort((a, b) => {
                    const da = haversineKm(here, { lat: a.lat, lng: a.lng });
                    const db = haversineKm(here, { lat: b.lat, lng: b.lng });
                    return da - db;
                });
                if (!cancelled) setResults(sorted);
            } catch (e) {
                if (!cancelled) setResults([]);
                // optionally log
                console.warn('Search failed', e);
            } finally {
                if (!cancelled) setSearching(false);
            }
        }

        timer = setTimeout(run, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [q, sortCenter.lat, sortCenter.lng]);

    const filteredPins = useMemo(() => {
        if (filter === 'all') return pins;
        return pins.filter((p) => p.status === filter);
    }, [pins, filter]);

    function handleCreateAt(lat: number, lng: number) {
        setSelected(null);
        setDraft({ position: { lat, lng }, status: 'a-essayer', tags: [] });

        // Reverse geocode with the French government address API (best-effort)
        fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}&limit=1`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                const props = data?.features?.[0]?.properties;
                if (!props) return;
                setDraft((d) => ({
                    ...d,
                    address: props.name ?? props.label ?? null,
                    com_nom: props.city ?? null,
                    postal_code: props.citycode ?? null,
                }));
            })
            .catch(() => {/* geocoding is best-effort */});
    }

    async function submitDraft(e: React.FormEvent) {
        e.preventDefault();
        if (!draft.status) return;

        try {
            if (selected) {
                const input = {
                    status: draft.status as PinStatus,
                    notes: draft.notes || '',
                    tags: (draft.tags as string[]) || [],
                };
                const res = await updateUserPin(selected.id, input);
                const updated: RestaurantPin = {
                    ...selected,
                    ...input,
                    updatedAt: res.updatedAt,
                } as RestaurantPin;
                setPins((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                setSelected(updated);
                setDraft(updated);
            } else if ((draft as any).position && !(draft as any).osm_id) {
                // Custom pin created by clicking on the map
                const pos = (draft as any).position as { lat: number; lng: number };
                const created = await createCustomPin({
                    name: draft.name!,
                    lat: pos.lat,
                    lng: pos.lng,
                    address: draft.address ?? null,
                    com_nom: draft.com_nom ?? null,
                    postal_code: draft.postal_code ?? null,
                    status: draft.status as PinStatus,
                    notes: draft.notes || '',
                    tags: (draft.tags as string[]) || [],
                });
                setPins((prev) => [created, ...prev]);
                setSelected(created);
                setDraft(created);
            } else if ((draft as any).osm_id) {
                const input = {
                    osm_id: (draft as any).osm_id as string,
                    status: draft.status as PinStatus,
                    notes: draft.notes || '',
                    tags: (draft.tags as string[]) || [],
                };
                try {
                    const created = await createUserPin(input);
                    setPins((prev) => [created, ...prev]);
                    setSelected(created);
                    setDraft(created);
                } catch (err) {
                    if (err instanceof ApiError && err.status === 409) {
                        // Already exists: select existing pin
                        const existing = pins.find((p) => p.osm_id === (draft as any).osm_id);
                        if (existing) {
                            setSelected(existing);
                            setDraft(existing);
                        } else {
                            // Fallback: reload list
                            try {
                                const reload = await listUserPins();
                                setPins(reload);
                                const found = reload.find((p) => p.osm_id === (draft as any).osm_id);
                                if (found) {
                                    setSelected(found);
                                    setDraft(found);
                                }
                            } catch {}
                        }
                    } else {
                        throw err;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to submit pin', e);
        }
    }

    function onMarkerClick(pin: RestaurantPin) {
        // Ensure a state change even if the same pin is clicked again (so Panel's effect runs)
        setSelected((prev) => (prev?.id === pin.id ? { ...pin } : pin));
        setDraft(pin);
    }

    async function removeSelected() {
        if (!selected) return;
        const id = selected.id;
        try {
            await deleteUserPin(id);
            setPins((prev) => prev.filter((p) => p.id !== id));
            setSelected(null);
            setDraft({});
        } catch (e) {
            console.warn('Failed to delete pin', e);
        }
    }

    function cancelDraft() {
        setDraft({});
        setSelected(null);
    }

    function parseTags(input: string): string[] {
        return input
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 10);
    }

    const draftTagsString = Array.isArray(draft.tags) ? (draft.tags as string[]).join(', ') : '';

    if (status === 'loading') {
        return (
            <div className="flex h-[100dvh] w-full items-center justify-center bg-zinc-50">
                <div className="flex flex-col items-center gap-3">
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                    <span className="text-sm font-medium text-zinc-500">Chargement…</span>
                </div>
            </div>
        );
    }

    if (status !== 'authenticated') {
        return (
            <div className="flex h-[100dvh] w-full items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
                <div className="mx-4 w-full max-w-sm rounded-3xl border border-zinc-200/80 bg-white/90 p-8 shadow-xl shadow-black/5 backdrop-blur-xl sm:max-w-md sm:p-10">
                    <div className="mb-1 text-center text-3xl">📍</div>
                    <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-zinc-900">Pin Carta</h1>
                    <p className="mb-8 text-center text-sm text-zinc-500">Enregistrez et retrouvez vos restaurants favoris.</p>
                    <button
                        onClick={() => signIn('google')}
                        className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5">
                            <path
                                fill="#FFC107"
                                d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12 c3.059,0,5.842,1.156,7.957,3.043l5.657-5.657C33.64,6.053,29.082,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20 c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                            />
                            <path
                                fill="#FF3D00"
                                d="M6.306,14.691l6.571,4.819C14.655,16.361,18.961,14,24,14c3.059,0,5.842,1.156,7.957,3.043l5.657-5.657 C33.64,6.053,29.082,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
                            />
                            <path
                                fill="#4CAF50"
                                d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.191-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.277-7.946l-6.57,5.061C9.463,39.556,16.13,44,24,44z"
                            />
                            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.086-4.103,5.477l6.191,5.238 C35.888,35.221,44,30.5,44,20.083z" />
                        </svg>
                        <span>Continuer avec Google</span>
                    </button>
                    <p className="mt-4 text-center text-[11px] text-zinc-500">Vos données restent privées et sécurisées.</p>
                </div>
            </div>
        );
    }

    const panelProps = {
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
    };

    return (
        <div className="h-[100dvh] w-full">
            {view === 'addresses' ? (
                /* Addresses view: full-screen list, no map */
                <div className="relative h-full">
                    <NavBar activeView={view} onChangeView={setView} onSignOut={() => signOut()} />
                    <SavedAddresses
                        pins={pins}
                        filter={filter}
                        setFilter={setFilter}
                        onSelectPin={(pin) => {
                            onMarkerClick(pin);
                            setFocusAt(pin.position);
                            setView('map');
                        }}
                        sortCenter={sortCenter}
                    />
                </div>
            ) : (
                /* Map view: two-column on desktop, overlay sheet on mobile */
                <div className="relative h-full md:flex">
                    {/* Left column: map area */}
                    <div className="relative flex-1 min-w-0 h-full">
                        <NavBar activeView={view} onChangeView={setView} onSignOut={() => signOut()} />
                        <SearchBar
                            q={q}
                            setQ={setQ}
                            searching={searching}
                            results={results}
                            setResults={setResults}
                            setFocusAt={setFocusAt}
                            focusAt={focusAt}
                            onSelectResult={(r) => {
                                const existing = pins.find((p) => p.osm_id === r.osm_id);
                                if (existing) {
                                    setSelected(existing);
                                    setDraft(existing);
                                } else {
                                    const name = r.name || r.brand || r.operator || '(sans nom)';
                                    setSelected(null);
                                    setDraft({
                                        osm_id: r.osm_id,
                                        name,
                                        address: r.address,
                                        postal_code: r.postal_code,
                                        com_nom: r.com_nom,
                                        opening_hours: (r as any).opening_hours ?? null,
                                        position: { lat: r.lat, lng: r.lng },
                                        status: 'a-essayer',
                                        tags: [],
                                        notes: '',
                                    } as any);
                                }
                            }}
                        />
                        <MapView
                            pins={filteredPins}
                            onMapClick={handleCreateAt}
                            onMarkerClick={onMarkerClick}
                            onCenterChange={(lat, lng) => {
                                userMovedRef.current = true;
                                setSortCenter({ lat, lng });
                            }}
                            center={currentLoc}
                            focusAt={focusAt}
                            focusZoom={17}
                            onFocusMarkerClick={(lat, lng) => handleCreateAt(lat, lng)}
                            mobilePanelPeekHeight={PANEL_PEEK_HEIGHT_PX}
                            desktopSidebarWidth={DESKTOP_SIDEBAR_WIDTH_PX}
                        />
                    </div>

                    {/* Mobile: fixed bottom sheet (hidden on md+) */}
                    <div className="md:hidden pointer-events-none fixed inset-x-0 bottom-0 z-[1000] flex justify-center px-0 sm:px-4 sm:pb-4">
                        <div className="pointer-events-auto w-full max-w-xl rounded-t-3xl border border-zinc-200/80 bg-white/95 shadow-xl shadow-black/10 backdrop-blur-xl sm:rounded-3xl supports-[backdrop-filter]:bg-white/85">
                            <Panel variant="sheet" {...panelProps} />
                        </div>
                    </div>

                    {/* Desktop: right sidebar (hidden below md) */}
                    {/* pt accounts for the fixed NavBar height */}
                    <div className="hidden md:flex flex-col w-[380px] shrink-0 h-full border-l border-zinc-200 bg-white overflow-y-auto pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
                        <Panel variant="sidebar" {...panelProps} />
                    </div>
                </div>
            )}
        </div>
    );
}
