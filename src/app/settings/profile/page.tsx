import { auth } from '@/auth';

export default async function ProfilePage() {
    const session = await auth();

    return (
        <div>
            <h1 className="mb-4 text-lg font-bold text-zinc-900">Profil</h1>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Adresse e-mail</div>
                <div className="mt-1 text-sm text-zinc-900">{session?.user?.email}</div>
            </div>
        </div>
    );
}
