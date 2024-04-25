import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { nanoid } from '@/lib/utils'
import { Chat } from '@/components/chat'

export const runtime = 'edge'

export default async function IndexPage() {
  const id = nanoid()
  const cookieStore = cookies()
  const session = await auth({ cookieStore })

  return <Chat id={id} supaAccessToken={session?.access_token ?? ''} />
}
