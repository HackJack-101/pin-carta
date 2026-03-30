'use client';

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

                {/* Sign out */}
                <button
                    onClick={onSignOut}
                    title="Déconnexion"
                    aria-label="Déconnexion"
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 sm:px-3"
                >
                    {/* Icon on mobile, text on desktop */}
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    <span className="hidden sm:inline">Déconnexion</span>
                </button>
            </div>
        </nav>
    );
}
