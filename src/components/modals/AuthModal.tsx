'use client';
import Modal from '@/components/ui/Modal';
import { Landmark, ShieldCheck } from 'lucide-react';
export default function AuthModal({ onClose, onConnect, busy, error }: {
    onClose: () => void;
    onConnect: () => void;
    busy: boolean;
    error: string;
}) { return <Modal title="Transaction updates" onClose={onClose}><div className="connection-illustration"><Landmark size={44}/></div><p>Bring today's transactions into your apartment and see how your choices shape your life.</p><div className="notice"><ShieldCheck size={20}/><span>Updates match your current game day and can be loaded once each day. End day when you are ready for your daily review.</span></div>{error && <p className="error" role="alert">{error}</p>}<button className="button primary full-width" disabled={busy} onClick={onConnect}>{busy ? 'Updating...' : 'Update transactions'}</button></Modal>; }
