import { NextResponse } from 'next/server'
import { Repository } from '@/lib/db/schema'
import { getOctokit } from '@/lib/github'
import { getGitlabClient } from '@/lib/gitlab'
import { eq, gte } from 'drizzle-orm'
import { repositories } from '@/lib/db/schema'
import { getCachedRepositories, upsertRepositories } from '@/lib/db/queries'

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'
    
    if (!forceRefresh) {
      const cachedRepositories = await getCachedRepositories(CACHE_DURATION)

      if (cachedRepositories.length > 0) {
        return NextResponse.json(cachedRepositories)
      }
    }

    // Fetch repositories from GitHub
    const octokit = await getOctokit()
    const githubRepos = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    })

    // Fetch repositories from GitLab
    const gitlab = await getGitlabClient()
    const gitlabProjects = await gitlab.Projects.all({
      membership: true,
      orderBy: 'last_activity_at',
      sort: 'desc',
    })

    // Combine and format the repositories
    const repositoriesData: Omit<Repository, 'createdAt' | 'updatedAt'>[] = [
      ...githubRepos.data.map(repo => ({
        id: repo.id.toString(),
        name: repo.name,
        lastSynced: new Date(),
        maintainability: 80, // Placeholder value
        testCoverage: 75, // Placeholder value
        monitoredBranches: [repo.default_branch],
        lastCommit: new Date(repo.pushed_at || Date.now()),
        userRole: repo.permissions?.admin ? 'admin' : 'contributor',
        openPullRequests: repo.open_issues_count,
        provider: 'github',
      })),
      ...gitlabProjects.map(project => ({
        id: project.id.toString(),
        name: project.name,
        lastSynced: new Date(),
        maintainability: 80, // Placeholder value
        testCoverage: 75, // Placeholder value
        monitoredBranches: [project.default_branch],
        lastCommit: new Date(project.last_activity_at),
        userRole: project.permissions.project_access?.access_level >= 40 ? 'admin' : 'contributor',
        openPullRequests: project.open_issues_count,
        provider: 'gitlab',
      }))
    ]

    // Update or insert repositories in the database
    await upsertRepositories(repositoriesData)

    return NextResponse.json(repositoriesData)
  } catch (error) {
    console.error('Error fetching repositories:', error)
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 })
  }
}