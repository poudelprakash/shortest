import { TestFile, PullRequest } from "../app/(dashboard)/dashboard/types";
import * as github from "./github";
import * as gitlab from "./gitlab";

export async function getAssignedPullRequests() {
  try {
    // Fetch from both GitHub and GitLab
    const [githubPullRequests, gitlabMergeRequests] = await Promise.all([
      github.getAssignedPullRequests(),
      gitlab.getAssignedMergeRequests(),
    ]);

    // Handle GitHub response
    const githubResults = Array.isArray(githubPullRequests)
      ? githubPullRequests.map(pr => ({
          ...pr,
          source: 'github',
        }))
      : []; // If GitHub returns an error, fallback to an empty array

    // Handle GitLab response
    const gitlabResults = Array.isArray(gitlabMergeRequests)
      ? gitlabMergeRequests.map(mr => ({
          ...mr,
          source: 'gitlab',
        }))
      : []; // If GitLab returns an error, fallback to an empty array

    // Combine the results into a unified format
    const allRequests = [...githubResults, ...gitlabResults];

    return allRequests;
  } catch (error) {
    console.error("Error fetching assigned pull requests:", error);
    throw new Error("Failed to fetch assigned pull requests.");
  }
}

export async function commitChangesToPullRequest(
  pullRequest: PullRequest,
  filesToCommit: TestFile[],
  commitMessage: string
): Promise<string> {
  try {
    if (pullRequest.source === 'github') {
      return await github.commitChangesToPullRequest(
        pullRequest.repository.owner.login,
        pullRequest.repository.name,
        pullRequest.number,
        filesToCommit,
        commitMessage
      );
    } else if (pullRequest.source === 'gitlab') {
      return await gitlab.commitChangesToMergeRequest(
        pullRequest.repository.id,
        pullRequest.number,
        filesToCommit,
        commitMessage
      );
    }
    throw new Error(`Unsupported git provider: ${pullRequest.source}`);
  } catch (error) {
    console.error("Error committing changes to pull request:", error);
    throw error;
  }
}

export async function getPullRequestInfo(pullRequest: PullRequest) {
  try {
    if (pullRequest.source === 'github') {
      return await github.getPullRequestInfo(
        pullRequest.repository.owner.login,
        pullRequest.repository.name,
        pullRequest.number
      );
    } else if (pullRequest.source === 'gitlab') {
      return await gitlab.getMergeRequestInfo(
        pullRequest.repository.id,
        pullRequest.number
      );
    }
    throw new Error(`Unsupported git provider: ${pullRequest.source}`);
  } catch (error) {
    console.error("Error fetching pull request info:", error);
    throw error;
  }
}

export async function getFailingTests(pullRequest: PullRequest): Promise<TestFile[]> {
  try {
    if (pullRequest.source === 'github') {
      return await github.getFailingTests(
        pullRequest.repository.owner.login,
        pullRequest.repository.name,
        pullRequest.number
      );
    } else if (pullRequest.source === 'gitlab') {
      return await gitlab.getFailingTests(
        pullRequest.repository.id,
        pullRequest.number
      );
    }
    throw new Error(`Unsupported git provider: ${pullRequest.source}`);
  } catch (error) {
    console.error("Error fetching failing tests:", error);
    throw error;
  }
}

export async function fetchBuildStatus(pullRequest: PullRequest) {
  try {
    if (pullRequest.source === 'github') {
      return await github.fetchBuildStatus(
        pullRequest.repository.owner.login,
        pullRequest.repository.name,
        pullRequest.number
      );
    } else if (pullRequest.source === 'gitlab') {
      return await gitlab.fetchBuildStatus(
        pullRequest.repository.id,
        pullRequest.number
      );
    }
    throw new Error(`Unsupported git provider: ${pullRequest.source}`);
  } catch (error) {
    console.error("Error fetching build status:", error);
    throw error;
  }
}

export async function getWorkflowLogs(pullRequest: PullRequest, runId: string): Promise<string> {
  try {
    if (pullRequest.source === 'github') {
      return await github.getWorkflowLogs(
        pullRequest.repository.owner.login,
        pullRequest.repository.name,
        runId
      );
    } else if (pullRequest.source === 'gitlab') {
      return await gitlab.getWorkflowLogs(
        pullRequest.repository.id,
        runId
      );
    }
    throw new Error(`Unsupported git provider: ${pullRequest.source}`);
  } catch (error) {
    console.error("Error getting workflow logs:", error);
    throw error;
  }
}

export async function getLatestRunId(pullRequest: PullRequest): Promise<string | null> {
  try {
    if (pullRequest.source === 'github') {
      return await github.getLatestRunId(
        pullRequest.repository.owner.login,
        pullRequest.repository.name,
        pullRequest.branchName
      );
    } else if (pullRequest.source === 'gitlab') {
      return await gitlab.getLatestRunId(
        pullRequest.repository.id,
        pullRequest.branchName
      );
    }
    throw new Error(`Unsupported git provider: ${pullRequest.source}`);
  } catch (error) {
    console.error("Error getting latest run ID:", error);
    throw error;
  }
}
