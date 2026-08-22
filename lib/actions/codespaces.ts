'use server'

import { db } from '@/lib/db'
import { tasks, sandboxRepos, sandboxUsers, developers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/auth'

/**
 * Invites the developer to the private mirror repository of a task.
 */
export async function inviteDeveloperToMirror(taskId: string, developerUserId: string) {
  // Developer lookup only depends on developerUserId, not on the task/repo/
  // owner chain below — kick it off now so it resolves in parallel with that
  // chain instead of only starting once the chain finishes.
  const devResultPromise = db.query.developers.findFirst({
    where: eq(developers.userId, developerUserId),
  })

  // 1. Get task and mirror repo details
  const taskResult = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  })
  if (!taskResult || !taskResult.sandboxRepoId) {
    throw new Error('Task or Sandbox repository not found.')
  }

  const repoResult = await db.query.sandboxRepos.findFirst({
    where: eq(sandboxRepos.id, taskResult.sandboxRepoId),
  })
  if (!repoResult) {
    throw new Error('Sandbox repository details not found.')
  }

  // 2. Get owner (sandboxUser) token to perform administrative action (invitation)
  const ownerResult = await db.query.sandboxUsers.findFirst({
    where: eq(sandboxUsers.id, repoResult.ownerId),
  })
  if (!ownerResult || !ownerResult.accessToken) {
    throw new Error('Owner GitHub authentication token not found.')
  }

  // 3. Get developer's GitHub username
  const devResult = await devResultPromise
  if (!devResult || !devResult.username) {
    throw new Error('Developer GitHub username not found.')
  }

  const repoPath = repoResult.sandboxRepo // e.g. "forke-sandbox/owner-repo-mirror"
  const inviteUrl = `https://api.github.com/repos/${repoPath}/collaborators/${devResult.username}`

  console.log(`[Codespace CLI] Inviting developer ${devResult.username} to ${repoPath}...`)
  
  const response = await fetch(inviteUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${ownerResult.accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Forke-IDE/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      permission: 'write', // Grant write access to edit/commit
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to invite developer: ${errorData.message || response.statusText}`)
  }

  // Status can be 201 (Created invitation) or 204 (Already a collaborator)
  if (response.status === 204) {
    return { accepted: true, repository: repoPath }
  }

  const data = await response.json()
  return {
    accepted: false,
    invitationId: data.id,
    repository: repoPath,
    htmlUrl: data.html_url || `https://github.com/${repoPath}/invitations`,
  }
}

/**
 * Checks if the developer has accepted the collaborator invite for the mirror repository.
 */
export async function checkInvitationStatus(taskId: string, developerUserId: string) {
  // Independent of the task/repo chain below — kick off in parallel.
  const devResultPromise = db.query.developers.findFirst({
    where: eq(developers.userId, developerUserId),
  })

  const taskResult = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  })
  if (!taskResult || !taskResult.sandboxRepoId) return { accepted: false }

  const repoResult = await db.query.sandboxRepos.findFirst({
    where: eq(sandboxRepos.id, taskResult.sandboxRepoId),
  })
  if (!repoResult) return { accepted: false }

  const devResult = await devResultPromise
  if (!devResult || !devResult.username || !devResult.accessToken) return { accepted: false }

  // Check if developer is collaborator
  const checkUrl = `https://api.github.com/repos/${repoResult.sandboxRepo}/collaborators/${devResult.username}`
  const response = await fetch(checkUrl, {
    headers: {
      Authorization: `Bearer ${devResult.accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Forke-IDE/1.0',
    },
  })

  return { accepted: response.status === 204 }
}

/**
 * Creates the developer workspace branch and spins up the GitHub Codespace.
 */
export async function createWorkspaceBranchAndCodespace(taskId: string, developerUserId: string) {
  // Independent of the task/repo chain below — kick off in parallel.
  const devResultPromise = db.query.developers.findFirst({
    where: eq(developers.userId, developerUserId),
  })

  // 1. Fetch task and repo details
  const taskResult = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  })
  if (!taskResult || !taskResult.sandboxRepoId) {
    throw new Error('Task not found.')
  }

  const repoResult = await db.query.sandboxRepos.findFirst({
    where: eq(sandboxRepos.id, taskResult.sandboxRepoId),
  })
  if (!repoResult) {
    throw new Error('Sandbox repository details not found.')
  }

  // 2. Fetch tokens
  const devResult = await devResultPromise
  if (!devResult || !devResult.accessToken || !devResult.username) {
    throw new Error('Developer GitHub access credentials not found.')
  }

  const templateRepo = repoResult.sandboxRepo
  const devRepoName = `forke-task-${taskId}`
  const devRepoPath = `${devResult.username}/${devRepoName}`

  // 3. Step A: Check if developer already has the personal repository created for this task
  const checkRepoUrl = `https://api.github.com/repos/${devRepoPath}`
  const checkRepoRes = await fetch(checkRepoUrl, {
    headers: {
      Authorization: `Bearer ${devResult.accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Forke-IDE/1.0',
    },
  })

  if (checkRepoRes.status === 404) {
    // Generate/fork the private repo from template to developer's account
    console.log(`[Codespace CLI] Creating personal private repository ${devRepoPath} from template ${templateRepo}...`)
    const generateUrl = `https://api.github.com/repos/${templateRepo}/generate`
    const generateResponse = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devResult.accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Forke-IDE/1.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: devRepoName,
        private: true,
        description: `Forke secure sandbox workspace for Task #${taskId}`,
      }),
    })

    if (!generateResponse.ok) {
      const errData = await generateResponse.json().catch(() => ({}))
      throw new Error(`Failed to generate personal repository from template: ${errData.message || generateResponse.statusText}`)
    }

    // Wait a couple of seconds for GitHub's async repository generation to complete
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  // 4. Step B: Create Codespace targeting the main branch of the developer's personal repository (using Developer token)
  const codespaceUrl = `https://api.github.com/repos/${devRepoPath}/codespaces`
  console.log(`[Codespace CLI] Spinning up Codespace on personal repository targeting main branch...`)

  const codespaceResponse = await fetch(codespaceUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${devResult.accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Forke-IDE/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main',
      machine: 'basicLinux32gb', // standard machine (2 cores, 4GB RAM, 32GB Storage)
    }),
  })

  const codespaceData = await codespaceResponse.json()
  if (!codespaceResponse.ok) {
    throw new Error(`Failed to spin up GitHub Codespace: ${codespaceData.message || codespaceResponse.statusText}`)
  }

  // 5. Save Codespace info to DB
  await db.update(tasks).set({
    codespaceName: codespaceData.name,
    codespaceUrl: codespaceData.web_url || `https://github.com/codespaces/${codespaceData.name}`,
    codespaceStatus: codespaceData.state || 'starting',
  }).where(eq(tasks.id, taskId))

  return {
    codespaceName: codespaceData.name,
    codespaceUrl: codespaceData.web_url,
    status: codespaceData.state,
  }
}

/**
 * Deletes the Codespace and removes the developer from the repo collaborators when complete or abandoned.
 */
export async function cleanupWorkspace(taskId: string, developerUserId: string) {
  // Independent of the task/repo chain below — kick off in parallel.
  const devResultPromise = db.query.developers.findFirst({
    where: eq(developers.userId, developerUserId),
  })

  // 1. Fetch task and repo details
  const taskResult = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  })
  if (!taskResult || !taskResult.sandboxRepoId) return

  const repoResult = await db.query.sandboxRepos.findFirst({
    where: eq(sandboxRepos.id, taskResult.sandboxRepoId),
  })
  if (!repoResult) return

  // 2. Fetch credentials
  const devResult = await devResultPromise
  if (!devResult || !devResult.username || !devResult.accessToken) return

  const ownerResult = await db.query.sandboxUsers.findFirst({
    where: eq(sandboxUsers.id, repoResult.ownerId),
  })
  if (!ownerResult || !ownerResult.accessToken) return

  // 3. Delete Codespace VM if it exists in our DB
  if (taskResult.codespaceName) {
    const deleteUrl = `https://api.github.com/user/codespaces/${taskResult.codespaceName}`
    console.log(`[Codespace CLI] Deleting Codespace ${taskResult.codespaceName}...`)
    
    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${devResult.accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Forke-IDE/1.0',
      },
    }).catch(err => {
      console.error('[Codespace CLI] Failed to delete Codespace VM:', err)
    })
  }

  // 4. Delete the developer's personal repository from their account
  const devRepoName = `forke-task-${taskId}`
  const deleteRepoUrl = `https://api.github.com/repos/${devResult.username}/${devRepoName}`
  console.log(`[Codespace CLI] Deleting developer repository ${devResult.username}/${devRepoName}...`)
  
  await fetch(deleteRepoUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${devResult.accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Forke-IDE/1.0',
    },
  }).catch(err => {
    console.error('[Codespace CLI] Failed to delete developer repository:', err)
  })

  // 5. Remove developer from template repo collaborators list
  const repoPath = repoResult.sandboxRepo
  const collabUrl = `https://api.github.com/repos/${repoPath}/collaborators/${devResult.username}`
  console.log(`[Codespace CLI] Removing collaborator ${devResult.username} from template ${repoPath}...`)
  
  await fetch(collabUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${ownerResult.accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Forke-IDE/1.0',
    },
  }).catch(err => {
    console.error('[Codespace CLI] Failed to remove template collaborator:', err)
  })

  // 6. Clean up columns in DB
  await db.update(tasks).set({
    codespaceName: null,
    codespaceUrl: null,
    codespaceStatus: null,
  }).where(eq(tasks.id, taskId))
}
