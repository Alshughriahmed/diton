import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ChatClient from './ChatClient';

export default async function ChatPage() {
  // فحص العمر server-side
  const cookieStore = await cookies();
  const ageok = cookieStore.get('ageok')?.value === '1';
  const ageJwt = Boolean(cookieStore.get('age_jwt')?.value);
  
  // إن لم يكن العمر مُوثّق: إعادة توجيه 307
  if (!ageok && !ageJwt) {
    redirect('/api/age/start?return=/chat');
  }

  return <ChatClient />;
}