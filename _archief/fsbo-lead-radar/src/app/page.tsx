import { redirect } from 'next/navigation'

/** Er is maar één ding te doen op deze dienst: het dashboard bekijken. */
export default function HomePage() {
  redirect('/admin')
}
