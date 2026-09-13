import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from './session';

export async function currentUserId(): Promise<string | null> { return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value); }
