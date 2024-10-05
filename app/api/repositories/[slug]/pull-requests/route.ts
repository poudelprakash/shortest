import { NextResponse } from 'next/server'
import { getOctokit } from '@/lib/github'
import { getGitlabClient } from '@/lib/gitlab'
import { db } from '@/lib/db/drizzle'
import { repositories } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params
  const { searchParams } = new URL(request.url)
  const providerParam = searchParams.get('provider')

  try {
    let repoProvider = providerParam

    // If provider is not in URL, fetch from database
    if (!repoProvider) {
      let repoData = await db.query.repositories.findFirst({
        where: eq(repositories.id, slug),
      })
      repoProvider = repoData?.provider
    }

    // Validate provider if it's not null
    if (repoProvider && repoProvider !== 'github' && repoProvider !== 'gitlab') {
      return NextResponse.json({ error: 'Wrong Git Provider Provided' }, { status: 400 })
    }

    let pullRequests
    if (repoProvider === 'gitlab') {
      const gitlabClient = await getGitlabClient()
      const mergeRequests = await gitlabClient.MergeRequests.all({ projectId: slug, state: 'opened' })
      pullRequests = mergeRequests.map(mr => ({
        id: mr.id,
        number: mr.iid,
        title: mr.title,
        html_url: mr.web_url,
        user: {
          login: mr.author.username
        },
        created_at: mr.created_at
      }))
    } else if (repoProvider === 'github') {
      const octokit = await getOctokit()
      
      // Remove any leading or trailing slashes and split the slug
      const [owner, repo] = slug.replace(/^\/|\/$/g, '').split('/')

      // Check if owner and repo are valid
      if (!owner || !repo) {
        return NextResponse.json({ error: 'Invalid GitHub repository slug' }, { status: 400 })
      }

      try {
        const { data } = await octokit.rest.pulls.list({
          owner,
          repo,
          state: 'open',
          per_page: 100
        })
        pullRequests = data.map(pr => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          html_url: pr.html_url,
          user: {
            login: pr.user?.login || 'Unknown'
          },
          created_at: pr.created_at
        }))
      } catch (githubError) {
        console.error('GitHub API error:', githubError)
        return NextResponse.json({ error: 'Failed to fetch GitHub pull requests' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'Provider not specified' }, { status: 400 })
    }

    // Update the repository in the database with the latest open pull request count
    await db.update(repositories)
      .set({ openPullRequests: pullRequests.length, updatedAt: new Date() })
      .where(eq(repositories.id, slug))

    return NextResponse.json(pullRequests)
  } catch (error) {
    console.error('Error fetching pull requests:', error)
    return NextResponse.json({ error: 'Failed to fetch pull requests' }, { status: 500 })
  }
}