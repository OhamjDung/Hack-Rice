'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, DoorOpen, KeyRound } from 'lucide-react';
import Game from './Game';
import OnboardingModal from '@/components/modals/OnboardingModal';
import Modal from '@/components/ui/Modal';
import { createGame } from '@/engine/RulesEngine';
import { type GameState, type Profile } from '@/engine/Types';
import styles from './Landing.module.css';

export default function Landing() {
    const [game, setGame] = useState<GameState | null>(null);
    const [pendingGame, setPendingGame] = useState<GameState | null>(null);
    const [dialog, setDialog] = useState<'new' | 'login' | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [checkingSession, setCheckingSession] = useState(true);
    const gameRef = useRef<HTMLDivElement>(null);

    // A cookie session may already be live (page refresh) — silently resume it.
    useEffect(() => { (async () => {
        try {
            const me = await fetch('/api/auth/me').then(r => r.json());
            if (me.success && me.data) {
                const loaded = await fetch('/api/game').then(r => r.json());
                if (loaded.success) setGame(loaded.data);
            }
        } catch { /* fall through to the login screen */ }
        finally { setCheckingSession(false); }
    })(); }, []);

    useEffect(() => {
        if (!pendingGame) return;
        const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240;
        const timer = window.setTimeout(() => { setGame(pendingGame); setPendingGame(null); }, delay);
        return () => window.clearTimeout(timer);
    }, [pendingGame]);

    useEffect(() => { if (game) { window.scrollTo({ top: 0, behavior: 'instant' }); gameRef.current?.focus({ preventScroll: true }); } }, [game]);

    function beginGame(next: GameState) { setDialog(null); setPendingGame(next); }

    async function readResponse(res: Response) {
        const value: unknown = await res.json();
        if (!(value as { success?: boolean })?.success) throw new Error((value as { error?: string })?.error || 'Request failed.');
        return value as { data: unknown };
    }

    async function signup(profile: Profile, creds?: { username: string; password: string }) {
        if (!creds) return;
        setBusy(true); setError('');
        try {
            const initialState = createGame(profile);
            await readResponse(await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: creds.username, password: creds.password, initialState }) }));
            beginGame(initialState);
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not create your account.'); }
        finally { setBusy(false); }
    }

    async function login(username: string, password: string) {
        setBusy(true); setError('');
        try {
            await readResponse(await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }));
            const loaded = await readResponse(await fetch('/api/game'));
            beginGame(loaded.data as GameState);
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not log in.'); }
        finally { setBusy(false); }
    }

    if (checkingSession) return <div className={styles.landing} aria-busy="true" />;
    if (game) return <div ref={gameRef} className={styles.gameEntrance} tabIndex={-1} role="region" aria-label="CashBound game"><Game initialGame={game} /></div>;

    return <main className={`${styles.landing} ${pendingGame ? styles.leaving : ''}`} inert={!!pendingGame} aria-busy={!!pendingGame}>
        <header className={styles.brand}>
            <img src="/room-economy-mark.svg" width={48} height={48} alt="" />
            <span>Cash<strong>Bound</strong></span>
        </header>
        <section className={styles.welcome} aria-labelledby="welcome-title">
            <p className={styles.eyebrow}>ONE ROOM. YOUR WHOLE LIFE.</p>
            <h1 id="welcome-title">A little room.<br />A life of your own.</h1>
            <p className={styles.intro}>Make a budget, settle in, and see how everyday choices shape your world.</p>
            <h2>Is this your first time here?</h2>
            <div className={styles.choices}>
                <button className={styles.choice} onClick={() => { setError(''); setDialog('new'); }}>
                    <DoorOpen size={25} aria-hidden="true" />
                    <span><strong>New user</strong><small>Create an account and move in.</small></span>
                    <ArrowRight size={20} aria-hidden="true" />
                </button>
                <button className={styles.choice} onClick={() => { setError(''); setDialog('login'); }}>
                    <KeyRound size={25} aria-hidden="true" />
                    <span><strong>Returning user</strong><small>Log in and pick up where you left off.</small></span>
                    <ArrowRight size={20} aria-hidden="true" />
                </button>
            </div>
            <p className={styles.note}>Your account works from any device you log into.</p>
        </section>
        <footer className={styles.footer}>Make a living. Build a life.</footer>
        {dialog === 'new' && <OnboardingModal credentials credentialsBusy={busy} credentialsError={error} onStart={signup} onClose={() => setDialog(null)} />}
        {dialog === 'login' && <LoginModal busy={busy} error={error} onSubmit={login} onClose={() => setDialog(null)} />}
    </main>;
}

function LoginModal({ busy, error, onSubmit, onClose }: { busy: boolean; error: string; onSubmit: (username: string, password: string) => void; onClose: () => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    return <Modal title="Welcome back" onClose={onClose}>
        <form onSubmit={e => { e.preventDefault(); onSubmit(username, password); }} className="setup-form">
            <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required /></label>
            <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="modal-actions">
                <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="button primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}<ArrowRight size={16} /></button>
            </div>
        </form>
    </Modal>;
}
