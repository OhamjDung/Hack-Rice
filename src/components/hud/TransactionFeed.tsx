import { ArrowDownLeft, ArrowUpRight, ReceiptText } from 'lucide-react';
import type { BankTransaction } from '@/engine/Types';
import { money } from './TopStatusBar';
import { CATEGORY_META } from '@/engine/Constants';
export default function TransactionFeed({ transactions, expanded, onExpand }: {
    transactions: BankTransaction[];
    expanded: boolean;
    onExpand: () => void;
}) { return <section className="panel transactions"><div className="section-heading"><h2>Life, in transactions <span className="count">{transactions.length}</span></h2><button className="text-button" onClick={onExpand}>{expanded ? 'Show less' : 'View all'} <ArrowUpRight size={14}/></button></div>{!transactions.length ? <div className="empty-state"><ReceiptText size={25}/><div><strong>Your story starts with a transaction.</strong><p>Add a purchase or inspect something in your room.</p></div></div> : <div className="transaction-list">{transactions.slice(0, expanded ? 100 : 4).map(t => <div className="transaction" key={t.id}><span className={`transaction-icon ${t.kind === 'income' ? 'income' : ''}`}>{t.kind === 'income' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</span><div className="transaction-description"><strong>{t.description}</strong><span>{t.paymentDate} <i>·</i> {CATEGORY_META[t.category].label}</span></div><strong className={t.kind === 'income' ? 'positive' : ''}>{t.kind === 'income' ? '+' : '−'}{money(t.amount)}</strong></div>)}</div>}</section>; }
