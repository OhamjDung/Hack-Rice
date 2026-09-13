'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ArrowRight, DoorOpen, KeyRound, Upload } from 'lucide-react';
import Game from './Game';
import OnboardingModal from '@/components/modals/OnboardingModal';
import Modal from '@/components/ui/Modal';
import { createGame } from '@/engine/RulesEngine';
import { stateSchema, type GameState } from '@/engine/Types';
import { exportGame, loadGame } from '@/lib/storage';
import styles from './Landing.module.css';

export default function Landing() {
    const [game, setGame] = useState<GameState | null>(null);
    const [pendingGame, setPendingGame] = useState<GameState | null>(null);
    const [dialog, setDialog] = useState<'new' | 'replace' | 'returning' | null>(null);
    const [saved, setSaved] = useState<GameState | null>(null);
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);
    const gameRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!pendingGame) return;
        const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240;
        const timer = window.setTimeout(() => {
            setGame(pendingGame);
            setPendingGame(null);
        }, delay);
        return () => window.clearTimeout(timer);
    }, [pendingGame]);

    useEffect(() => {
        if (game) {
            window.scrollTo({ top: 0, behavior: 'instant' });
            gameRef.current?.focus({ preventScroll: true });
        }
    }, [game]);

    function beginGame(next: GameState) {
        setDialog(null);
        setPendingGame(next);
    }

    function enter(kind: 'new' | 'returning') {
        setError('');
        try {
            const existing = loadGame();
            setSaved(existing);
            if (kind === 'returning' && existing) { beginGame(existing); return; }
            setDialog(kind === 'new' && existing ? 'replace' : kind);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not access your saved game.');
            setDialog(kind === 'new' ? 'replace' : 'returning');
        }
    }

    async function importSave(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            if (file.size > 2000000) throw new Error('Save file is too large. Maximum size is 2 MB.');
            beginGame(stateSchema.parse(JSON.parse(await file.text())));
        } catch {
            setError('Choose a valid CashBound JSON save under 2 MB.');
        } finally { event.target.value = ''; }
    }

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
                <button className={styles.choice} onClick={() => enter('new')}>
                    <DoorOpen size={25} aria-hidden="true" />
                    <span><strong>New user</strong><small>Create your character and move in.</small></span>
                    <ArrowRight size={20} aria-hidden="true" />
                </button>
                <button className={styles.choice} onClick={() => enter('returning')}>
                    <KeyRound size={25} aria-hidden="true" />
                    <span><strong>Returning user</strong><small>Pick up where you left off.</small></span>
                    <ArrowRight size={20} aria-hidden="true" />
                </button>
            </div>
            <p className={styles.note}>Your progress is saved in this browser. No account needed.</p>
        </section>
        <footer className={styles.footer}>Make a living. Build a life.</footer>
        {dialog === 'new' && <OnboardingModal onStart={profile => beginGame(createGame(profile))} onClose={() => setDialog(null)} />}
        {dialog === 'replace' && <Modal title="Start a new chapter?" onClose={() => setDialog(null)}>
            <p>A save already exists in this browser. Moving in with a new character will replace it. You can export a copy first.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="modal-actions">
                {saved && <button className="button secondary" onClick={() => exportGame(saved)}>Export existing save</button>}
                <button className="button primary" onClick={() => { setError(''); setDialog('new'); }}>Set up new character</button>
            </div>
        </Modal>}
        {dialog === 'returning' && <Modal title="Welcome back" onClose={() => setDialog(null)}>
            <p>We couldn’t find a playable save in this browser. Import your exported save to continue, or start as a new user.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="modal-actions">
                <button className="button secondary" onClick={() => enter('new')}>New user</button>
                <button className="button primary" onClick={() => fileRef.current?.click()}><Upload size={17} />Import save</button>
            </div>
        </Modal>}
        <input ref={fileRef} type="file" accept=".json,application/json" hidden aria-label="Import CashBound save" onChange={importSave} />
    </main>;
}
