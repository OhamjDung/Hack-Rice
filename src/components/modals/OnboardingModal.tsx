'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { categories, profileSchema, type Profile } from '@/engine/Types';
import { CATEGORY_META, DEFAULT_PROFILE } from '@/engine/Constants';
export default function OnboardingModal({ profile, onStart, onClose }: {
    profile?: Profile;
    onStart: (p: Profile) => void;
    onClose: () => void;
}) {
    const { register, handleSubmit, watch, formState: { errors } } = useForm<Profile>({ resolver: zodResolver(profileSchema), defaultValues: profile || DEFAULT_PROFILE });
    const values = watch();
    return <Modal title={profile ? 'Plan your next month' : 'A little room. A lot of possibility.'} onClose={onClose}><p className="muted">Meet your character, give every dollar a job, and make yourself at home.</p><form onSubmit={handleSubmit(onStart)} className="setup-form"><div className="profile-preview"><div className="mini-person" style={{ background: values.shirtColor }}><i style={{ background: values.skinTone, borderTopColor: values.hairColor }}/></div><div><strong>{values.name || 'Your character'}</strong><p className="muted">Your next chapter starts here.</p></div></div><div className="form-grid"><label>Your name<input {...register('name')}/></label><label>Monthly take-home pay ($)<input type="number" {...register('income', { valueAsNumber: true })}/></label></div><div className="color-fields">{(['skinTone', 'hairColor', 'shirtColor', 'pantsColor'] as const).map((key, i) => <label key={key}>{['Skin', 'Hair', 'Shirt', 'Pants'][i]}<input type="color" {...register(key)}/></label>)}</div><div className="section-heading"><h3>Monthly budget</h3><span className="muted">${Object.values(values.allocations).reduce((s, n) => s + (Number(n) || 0), 0).toLocaleString()} / ${Number(values.income || 0).toLocaleString()}</span></div><div className="form-grid">{categories.map(c => <label key={c}>{CATEGORY_META[c].label}<input type="number" min="0" step="1" {...register(`allocations.${c}`, { valueAsNumber: true })}/></label>)}</div>{Object.keys(errors).length > 0 && <p role="alert" className="error">Enter a name, valid amounts, and keep the total budget within your income.</p>}<div className="modal-actions"><button className="button primary" type="submit">{profile ? 'Save plan' : 'Move in'}<ArrowRight size={16}/></button></div></form></Modal>;
}
