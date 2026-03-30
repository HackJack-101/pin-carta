'use client';

import { useEffect, useRef, useState } from 'react';
import type { RestaurantPin } from '@/types';

// We import Leaflet dynamically inside effects to avoid SSR issues.

export interface MapViewProps {
    pins: RestaurantPin[];
    onMapClick?: (lat: number, lng: number) => void;
    onMarkerClick?: (pin: RestaurantPin) => void;
    onCenterChange?: (lat: number, lng: number) => void;
    center?: { lat: number; lng: number };
    zoom?: number;
    focusAt?: { lat: number; lng: number } | null; // center and highlight a temporary marker
    focusZoom?: number;
    onFocusMarkerClick?: (lat: number, lng: number) => void;
    /** Bottom panel height on mobile — used to offset flyTo so the pin lands in visible area */
    mobilePanelPeekHeight?: number;
    /** Right sidebar width on desktop — used to offset flyTo so the pin lands in visible area */
    desktopSidebarWidth?: number;
}

export default function MapView({
    pins,
    onMapClick,
    onMarkerClick,
    onCenterChange,
    center = { lat: 48.8566, lng: 2.3522 },
    zoom = 12,
    focusAt = null,
    focusZoom = 17,
    onFocusMarkerClick,
    mobilePanelPeekHeight = 0,
    desktopSidebarWidth = 0,
}: MapViewProps) {
    const mapRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const markersLayerRef = useRef<any>(null);
    const focusMarkerRef = useRef<any>(null);
    const onCenterChangeRef = useRef<((lat: number, lng: number) => void) | null>(null);
    const suppressNextCenterRef = useRef<boolean>(false);
    const mobilePanelPeekHeightRef = useRef(mobilePanelPeekHeight);
    const desktopSidebarWidthRef = useRef(desktopSidebarWidth);
    const moveEndHandlerRef = useRef<(() => void) | null>(null);
    const resizeCleanupRef = useRef<(() => void) | null>(null);
    const [mapReady, setMapReady] = useState(false);

    useEffect(() => { mobilePanelPeekHeightRef.current = mobilePanelPeekHeight; }, [mobilePanelPeekHeight]);
    useEffect(() => { desktopSidebarWidthRef.current = desktopSidebarWidth; }, [desktopSidebarWidth]);

    /** Returns an adjusted LatLng so the target point lands in the center of the visible map area. */
    function offsetCenter(map: any, lat: number, lng: number, targetZoom: number): [number, number] {
        const isMobile = window.innerWidth < 768;
        const offsetX = isMobile ? 0 : desktopSidebarWidthRef.current / 2;
        const offsetY = isMobile ? mobilePanelPeekHeightRef.current / 2 : 0;
        if (offsetX === 0 && offsetY === 0) return [lat, lng];
        const projected = map.project([lat, lng], targetZoom);
        const adjusted = map.unproject([projected.x + offsetX, projected.y + offsetY], targetZoom);
        return [adjusted.lat, adjusted.lng];
    }

    // Keep latest onCenterChange in a ref so event handler can call it
    useEffect(() => {
        (onCenterChangeRef as any).current = onCenterChange;
    }, [onCenterChange]);

    // Init map once
    useEffect(() => {
        let destroyed = false;
        (async () => {
            const L = await import('leaflet');
            if (destroyed) return;

            // Fix default icon paths in bundlers by using CDN
            L.Icon.Default.mergeOptions({
                iconUrl: 'marker-icon.png',
                iconRetinaUrl: 'marker-icon-2x.png',
                shadowUrl: 'marker-shadow.png',
            });

            const map = L.map(containerRef.current as HTMLDivElement).setView([center.lat, center.lng], zoom);
            mapRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(map);

            if (onMapClick) {
                map.on('click', (e: any) => {
                    const { lat, lng } = e.latlng;
                    onMapClick(lat, lng);
                });
            }

            // Emit center changes
            const handleMoveEnd = () => {
                if ((suppressNextCenterRef as any).current) {
                    (suppressNextCenterRef as any).current = false;
                    return;
                }
                const c = map.getCenter();
                const fn = (onCenterChangeRef as any).current as ((lat: number, lng: number) => void) | undefined;
                if (fn) fn(c.lat, c.lng);
            };
            map.on('moveend', handleMoveEnd);
            moveEndHandlerRef.current = handleMoveEnd;

            // Layer to hold markers for easier refresh
            markersLayerRef.current = L.layerGroup().addTo(map);

            // Move zoom control to bottom-right
            map.zoomControl.setPosition('bottomright');

            // Add a control button to center on user's current location
            const locateControl: any = (L.control as any)({ position: 'bottomright' });
            locateControl.onAdd = function () {
                const container = L.DomUtil.create('div', 'leaflet-bar');
                const btn = L.DomUtil.create('button', '', container) as HTMLButtonElement;
                btn.type = 'button';
                btn.title = 'Center on your location';
                btn.setAttribute('aria-label', 'Center on your location');
                btn.textContent = '📍';
                // Basic styling to make it visible even if Leaflet CSS is missing
                btn.style.width = '32px';
                btn.style.height = '32px';
                btn.style.lineHeight = '32px';
                btn.style.fontSize = '18px';
                btn.style.background = 'white';
                btn.style.border = '1px solid #ccc';
                btn.style.cursor = 'pointer';
                btn.style.borderRadius = '4px';
                btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
                // Prevent map interactions when clicking the button
                L.DomEvent.disableClickPropagation(btn);
                L.DomEvent.on(btn, 'click', () => {
                    if (!navigator.geolocation) {
                        console.warn('Geolocation not supported by this browser');
                        return;
                    }
                    btn.disabled = true;
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            const { latitude, longitude } = pos.coords;
                            (suppressNextCenterRef as any).current = true;
                            map.flyTo([latitude, longitude], 18, { duration: 0.5 });
                            btn.disabled = false;
                        },
                        (err) => {
                            console.warn('Geolocation error:', err);
                            btn.disabled = false;
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
                    );
                });
                return container;
            };
            locateControl.addTo(map);

            // initial draw
            redrawMarkers().catch((e) => console.error('redrawMarkers failed', e));

            // ensure size is correct after mount and on orientation/resize
            setTimeout(() => { map.invalidateSize(); setMapReady(true); }, 0);
            const onResize = () => map.invalidateSize();
            window.addEventListener('resize', onResize);
            // some mobile browsers fire orientationchange without resize
            window.addEventListener('orientationchange', onResize);
            resizeCleanupRef.current = () => {
                window.removeEventListener('resize', onResize);
                window.removeEventListener('orientationchange', onResize);
            };
        })();

        return () => {
            destroyed = true;
            if (mapRef.current) {
                const map = mapRef.current;
                if (moveEndHandlerRef.current) map.off('moveend', moveEndHandlerRef.current);
                resizeCleanupRef.current?.();
                map.remove();
                mapRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Redraw markers when pins change
    useEffect(() => {
        redrawMarkers().catch((e) => console.error('redrawMarkers failed', e));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pins]);

    // React to center/zoom prop changes after map is initialized.
    // Skip if focusAt is active — focusAt takes priority over the background center.
    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        if (focusAt) return;
        const map = mapRef.current;
        (suppressNextCenterRef as any).current = true;
        const [adjLat, adjLng] = offsetCenter(map, center.lat, center.lng, zoom);
        map.flyTo([adjLat, adjLng], zoom, { duration: 0.5 });
         
    }, [center?.lat, center?.lng, zoom, mapReady, focusAt]);

    // React to focusAt changes: center and add temporary marker.
    // Also re-runs when mapReady flips to true, so a focusAt set before the map
    // finished initializing is not silently dropped.
    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        (async () => {
            const map = mapRef.current;
            const L = await import('leaflet');
            if (focusMarkerRef.current) {
                focusMarkerRef.current.remove();
                focusMarkerRef.current = null;
            }
            if (focusAt) {
                (suppressNextCenterRef as any).current = true;
                const [adjLat, adjLng] = offsetCenter(map, focusAt.lat, focusAt.lng, focusZoom);
                map.flyTo([adjLat, adjLng], focusZoom, { duration: 0.5 });
                // Add a highlighted marker (default icon)
                const marker = L.marker([focusAt.lat, focusAt.lng]);
                marker.addTo(map);
                if (onFocusMarkerClick) {
                    marker.on('click', () => onFocusMarkerClick(focusAt.lat, focusAt.lng));
                }
                focusMarkerRef.current = marker;
            }
        })();
         
    }, [focusAt, focusZoom, onFocusMarkerClick, mapReady]);

    function statusColor(status: RestaurantPin['status']) {
        return status === 'deja-essaye' ? '#16a34a' : '#f59e0b'; // green or amber
    }

    async function redrawMarkers() {
        const L = await import('leaflet');
        if (!markersLayerRef.current) return;
        markersLayerRef.current.clearLayers();

        pins.forEach((pin) => {
            const div = document.createElement('div');
            const color = statusColor(pin.status);
            const SIZE = 18; // improve tap target
            div.style.width = `${SIZE}px`;
            div.style.height = `${SIZE}px`;
            div.style.background = color;
            div.style.borderRadius = '50%';
            div.style.border = '2px solid white';
            div.style.boxShadow = '0 0 0 1px #0003';
            div.style.pointerEvents = 'auto'; // ensure clicks/taps are captured

            const icon = L.divIcon({
                className: 'leaflet-div-icon', // keep Leaflet defaults (cursor/positioning)
                html: div,
                iconSize: [SIZE, SIZE] as any,
                iconAnchor: [SIZE / 2, SIZE / 2] as any,
            });
            const marker = L.marker([pin.position.lat, pin.position.lng], {
                icon,
                riseOnHover: true,
            });
            marker.addTo(markersLayerRef.current);
            marker.bindTooltip(pin.name, { permanent: false, direction: 'top' });
            if (onMarkerClick) {
                marker.on('click', () => onMarkerClick(pin));
            }
        });
    }

    return <div ref={containerRef} className="h-full w-full" />;
}
