'use client';
import { useForm } from 'react-hook-form';
import {useEffect,useRef,useState} from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Sparkles, LoaderCircle } from 'lucide-react';
import {auditInput,auditOutput,responseSchema} from '@/schemas/api';
import type {z} from 'zod';
import Modal from '@/components/ui/Modal';
import { categories, profileSchema, type Profile } from '@/engine/Types';
import { CATEGORY_META, DEFAULT_PROFILE } from '@/engine/Constants';
export default function OnboardingModal({ profile, onStart, onClose, credentials, credentialsBusy, credentialsError }: {
    profile?: Profile;
    onStart: (p: Profile, creds?: { username: string; password: string }) => void;
    onClose: () => void;
    /** When set, renders username/password fields and forwards them to onStart (new account signup). */
    credentials?: boolean;
    credentialsBusy?: boolean;
    credentialsError?: string;
}) {
    const { register, handleSubmit, watch, formState: { errors } } = useForm<Profile>({ resolver: zodResolver(profileSchema), defaultValues: profile || DEFAULT_PROFILE });
    const values = watch();
    const [username,setUsername]=useState(''),[password,setPassword]=useState('');
    const [checking,setChecking]=useState(false),[checkError,setCheckError]=useState('');
    const [review,setReview]=useState<z.infer<ReturnType<typeof responseSchema<typeof auditOutput>>>|null>(null);
    const controller=useRef<AbortController|null>(null);
    const budgetKey=JSON.stringify({income:values.income,jars:values.allocations});
    useEffect(()=>{controller.current?.abort();setChecking(false);setReview(null);setCheckError('');return()=>controller.current?.abort();},[budgetKey]);
    async function checkBudget(){
        const parsed=auditInput.safeParse({income:values.income,jars:values.allocations});
        if(!parsed.success){setCheckError('Enter your income and a valid amount for every category first.');return;}
        if(controller.current&&!controller.current.signal.aborted&&checking)return;
        const request=new AbortController();controller.current=request;setChecking(true);setCheckError('');setReview(null);
        try{
            const res=await fetch('/api/gemini/audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data),signal:AbortSignal.any([request.signal,AbortSignal.timeout(45000)])});
            const result=responseSchema(auditOutput).safeParse(await res.json());
            if(!res.ok||!result.success)throw new Error('Budget review is unavailable. Please try again.');
            if(!request.signal.aborted)setReview(result.data);
        }catch{if(!request.signal.aborted)setCheckError('Could not finish the budget check. Please try again.');}
        finally{if(!request.signal.aborted)setChecking(false);}
    }
    return <Modal title={profile ? 'Your profile & budget' : 'A little room. A lot of possibility.'} onClose={onClose}><p className="muted">Meet your character, give every dollar a job, and make yourself at home.</p><form onSubmit={handleSubmit(p=>onStart(p, credentials ? { username, password } : undefined))} className="setup-form"><div className="profile-preview"><div className="mini-person" style={{ background: values.shirtColor }}><i style={{ background: values.skinTone, borderTopColor: values.hairColor }}/></div><div><strong>{values.name || 'Your character'}</strong><p className="muted">Your next chapter starts here.</p></div></div>{credentials && <div className="form-grid"><label>Username<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={24}/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" required minLength={6}/></label></div>}{credentialsError&&<p role="alert" className="error">{credentialsError}</p>}<div className="form-grid"><label>Your name<input {...register('name')}/></label><label>Monthly take-home pay ($)<input type="number" {...register('income', { valueAsNumber: true })}/></label></div><div className="color-fields">{(['skinTone', 'hairColor', 'shirtColor', 'pantsColor'] as const).map((key, i) => <label key={key}>{['Skin', 'Hair', 'Shirt', 'Pants'][i]}<input type="color" {...register(key)}/></label>)}</div><div className="section-heading"><h3>Monthly budget</h3><span className="muted">${Object.values(values.allocations).reduce((s, n) => s + (Number(n) || 0), 0).toLocaleString()} / ${Number(values.income || 0).toLocaleString()}</span></div><div className="form-grid">{categories.map(c => <label key={c}>{CATEGORY_META[c].label}<input type="number" min="0" step="1" {...register(`allocations.${c}`, { valueAsNumber: true })}/></label>)}</div>{Object.keys(errors).length > 0 && <p role="alert" className="error">Enter a name, valid amounts, and keep the total budget within your income.</p>}{checkError&&<p role="alert" className="error">{checkError}</p>}{review&&<section className="budget-review" role="status"><strong>Budget review · {review.data.riskRating.toLowerCase()} risk</strong><p>{review.data.isValid?'This plan looks workable.':'This plan needs another look.'}</p><p>{review.data.commentary}</p><details><summary>Suggested category amounts</summary><dl>{categories.map(c=><div key={c}><dt>{CATEGORY_META[c].label}</dt><dd>{review.data.recommendedAdjustments[c].toLocaleString('en-US',{style:'currency',currency:'USD'})}</dd></div>)}</dl><small>Suggestions do not change your budget automatically.</small></details></section>}<div className="modal-actions setup-actions"><button className="button secondary budget-check" type="button" disabled={checking} onClick={checkBudget}>{checking?<LoaderCircle className="checking-spinner" size={16}/>:<Sparkles size={16}/>} {checking?'Checking your plan…':'Analyze'}</button><button className="button primary" type="submit" disabled={checking||credentialsBusy}>{profile ? 'Save plan' : credentialsBusy ? 'Moving in…' : 'Move in'}<ArrowRight size={16}/></button></div></form></Modal>;
}
