import { auth } from '@/auth'
import TopBar from '@/components/shared/TopBar'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, ne } from 'drizzle-orm'
import { getMessagesBetweenUsers } from './actions'
import ChatConsole from '@/components/messages/ChatConsole'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>
}) {
  const session = await auth()
  const sessionUser = session?.user

  if (!sessionUser) return null

  const params = await searchParams
  const queryUserId = params.userId

  // Registered contacts and the optionally-requested target user are
  // independent queries — fetch concurrently.
  const [contacts, targetUserRes] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        image: users.image,
        role: users.role,
        githubUrl: users.githubUrl,
      })
      .from(users)
      .where(ne(users.id, sessionUser.id))
      .limit(10),
    queryUserId
      ? db
          .select({
            id: users.id,
            name: users.name,
            image: users.image,
            role: users.role,
            githubUrl: users.githubUrl,
          })
          .from(users)
          .where(eq(users.id, queryUserId))
          .limit(1)
      : Promise.resolve([]),
  ])
  const targetUser = targetUserRes[0] || null

  if (targetUser && !contacts.some(c => c.id === targetUser.id)) {
    contacts.unshift(targetUser)
  }

  const activeContactId = targetUser?.id || contacts[0]?.id

  // Fetch initial message thread for active contact
  let initialMessages: any[] = []
  if (activeContactId) {
    const res = await getMessagesBetweenUsers(sessionUser.id, activeContactId)
    if (res.success) {
      initialMessages = res.messages
    }
  }

  return (
    <div className="flex flex-col h-full bg-transparent text-white font-sans">
      <TopBar title="Messages" />

      <div className="flex-grow px-5 md:px-8 py-6 md:py-8 select-none max-w-5xl mx-auto w-full min-h-0">
        <ChatConsole
          contacts={contacts} 
          currentUserId={sessionUser.id}
          initialMessages={initialMessages}
          defaultContactId={activeContactId}
        />
      </div>
    </div>
  )
}
