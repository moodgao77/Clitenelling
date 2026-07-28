import { redirect } from 'next/navigation';

// My Day lands here in the next build step; for now the client book is home.
export default function Home() {
  redirect('/people');
}
