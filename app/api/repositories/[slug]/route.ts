import { NextResponse } from 'next/server'
import { getOctokit } from '@/lib/github'
import { getGitlabClient } from '@/lib/gitlab'
import { eq } from 'drizzle-orm'
import { repositories } from '@/lib/db/schema'
import { db } from '@/lib/db/drizzle'

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params
  const { searchParams } = new URL(request.url)
  const refresh = searchParams.get('refresh') === 'true'
  const provider = searchParams.get('provider')

  try {
    // Check if we have the repository data in our database
    let repoData = await db.query.repositories.findFirst({
      where: eq(repositories.id, slug),
    })

    if (!repoData || refresh) {
      // Validate the provider
      if (provider !== 'github' && provider !== 'gitlab') {
        return NextResponse.json({ error: 'Invalid Git provider' }, { status: 400 })
      }

      let freshData
      if (provider === 'gitlab') {
        // Fetch from GitLab
        const gitlabClient = await getGitlabClient()
        const project = await gitlabClient.Projects.show(slug)
        freshData = {
          id: project.id.toString(),
          name: project.name,
          provider: 'gitlab',
          openPullRequests: project.open_merge_requests_count,
          lastSynced: new Date(),
          maintainability: 0, // You might need to calculate this based on your criteria
          testCoverage: 0, // You might need to fetch this separately
          monitoredBranches: [project.default_branch],
          lastCommit: new Date(project.last_activity_at),
          userRole: 'admin', // You might need to determine this based on user permissions
        }
      } else {
        // Fetch from GitHub
        const octokit = await getOctokit()
        const [owner, repo] = slug.split('/')
        const { data: repository } = await octokit.rest.repos.get({ owner, repo })
        const { data: pullRequests } = await octokit.rest.pulls.list({ owner, repo, state: 'open' })
        freshData = {
          id: repository.id.toString(),
          name: repository.name,
          provider: 'github',
          openPullRequests: pullRequests.length,
          lastSynced: new Date(),
          maintainability: 0, // You might need to calculate this based on your criteria
          testCoverage: 0, // You might need to fetch this separately
          monitoredBranches: [repository.default_branch],
          lastCommit: new Date(repository.updated_at),
          userRole: 'admin', // You might need to determine this based on user permissions
        }
      }

      // Update or insert the fresh data into the database
      await db.insert(repositories).values(freshData)
        .onConflictDoUpdate({
          target: repositories.id,
          set: freshData,
        })

      repoData = freshData
    }

    return NextResponse.json(repoData)
  } catch (error) {
    console.error('Error fetching repository data:', error)
    return NextResponse.json({ error: 'Failed to fetch repository data' }, { status: 500 })
  }
}