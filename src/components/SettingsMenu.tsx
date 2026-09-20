'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SettingsMenuProps {
    onSignOut: () => void;
}

const MENU_LINKS = [
    { href: '/settings/profile', label: 'Profil' },
    { href: '/settings/tags', label: 'Tags' },
    { href: '/settings/export', label: 'Export' },
    { href: '/settings/legal', label: 'Légal' },
] as const;

export default function SettingsMenu({ onSignOut }: SettingsMenuProps) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        function updateCoords() {
            const rect = buttonRef.current?.getBoundingClientRect();
            if (!rect) return;
            setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        }
        updateCoords();

        function handlePointerDown(e: MouseEvent) {
            const target = e.target as Node;
            if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        }

        document.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('resize', updateCoords);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('resize', updateCoords);
        };
    }, [open]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                title="Paramètres"
                aria-label="Paramètres"
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex items-center justify-center rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.752.43.992l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.71 6.71 0 010-.255c.007-.378-.138-.752-.43-.992l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>

            {open && coords &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        style={{ top: coords.top, right: coords.right }}
                        className="fixed z-[2000] w-48 overflow-hidden rounded-xl border border-zinc-200/80 bg-white/95 py-1 shadow-xl shadow-black/10 backdrop-blur-xl"
                    >
                        {MENU_LINKS.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                role="menuitem"
                                onClick={() => setOpen(false)}
                                className="block px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
                            >
                                {item.label}
                            </Link>
                        ))}
                        <div className="my-1 border-t border-zinc-200/80" />
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setOpen(false);
                                onSignOut();
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
                        >
                            Déconnexion
                        </button>
                    </div>,
                    document.body,
                )}
        </>
    );
}
