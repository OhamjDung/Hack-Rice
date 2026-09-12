'use client';
import Modal from '@/components/ui/Modal';
import { Landmark, ShieldCheck } from 'lucide-react';
export default function AuthModal({ onClose, onConnect, busy, error }: {
    onClose: () => void;
    onConnect: () => void;
    busy: boolean;
    error: string;
}) { return <Modal title="Connect your sandbox" onClose={onClose}><div className="connection-illustration"><Landmark size={44}/></div><p>Bring your Capital One Nessie sandbox transactions into your apartment. Your checking balance becomes your in-game cash.</p><p className="muted">This switches to a separate connected run. Export your demo save first if you want to return to it later.</p><div className="notice"><ShieldCheck size={20}/><span>Read-only connection. RoomEconomy never moves money in your account.</span></div><p className="muted">For this local build, set NESSIE_API_KEY and NESSIE_CUSTOMER_ID in .env.local, then restart the server. No banking password is needed.</p>{error && <p className="error" role="alert">{error}</p>}<button className="button primary full-width" disabled={busy} onClick={onConnect}>{busy ? 'Connecting…' : 'Connect Nessie account'}</button></Modal>; }
