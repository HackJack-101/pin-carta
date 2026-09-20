import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    if (!session?.user?.email) {
        redirect('/');
    }

    return (
        <div className="min-h-[100dvh] bg-zinc-50">
            <header className="border-b border-zinc-200/60 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
                <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
                    <Link
                        href="/"
                        title="Retour"
                        aria-label="Retour"
                        className="flex items-center justify-center rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                    </Link>
                    <span className="text-sm font-semibold text-zinc-900">Paramètres</span>
                </div>
            </header>
            <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">{children}</main>
        </div>
    );
}
