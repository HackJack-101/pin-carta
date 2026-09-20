'use client';

import SettingsMenu from '@/components/SettingsMenu';

export type ViewType = 'map' | 'addresses';

interface NavBarProps {
    activeView: ViewType;
    onChangeView: (v: ViewType) => void;
    onSignOut: () => void;
}

const TABS: { key: ViewType; label: string; icon: string }[] = [
    { key: 'map', label: 'Carte', icon: '🗺' },
    { key: 'addresses', label: 'Adresses', icon: '📍' },
];

export default function NavBar({ activeView, onChangeView, onSignOut }: NavBarProps) {

    return (
        <nav className="fixed inset-x-0 top-0 z-[1001] border-b border-zinc-200/60 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
            <div className="relative flex h-14 items-center justify-between px-4 sm:px-6">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <span className="text-sm font-bold tracking-tight text-zinc-900">Pin Carta</span>
                </div>

                {/* Tabs — centered */}
                <div className="absolute inset-x-0 flex justify-center pointer-events-none">
                    <div className="pointer-events-auto flex gap-1 rounded-xl bg-zinc-100/80 p-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                aria-current={activeView === tab.key ? 'page' : undefined}
                                onClick={() => onChangeView(tab.key)}
                                className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                                    activeView === tab.key
                                        ? 'bg-white text-zinc-900 shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-700'
                                }`}
                            >
                                <span className="text-sm">{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Settings */}
                <SettingsMenu onSignOut={onSignOut} />
            </div>
        </nav>
    );
}
