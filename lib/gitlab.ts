"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { Gitlab } from "@gitbeaker/rest";
import { CommitAction } from '@gitbeaker/core';
import { TestFile } from "../app/(dashboard)/dashboard/types";

export async function getGitlabClient() {
  const { userId } = auth();
  if (!userId) throw new Error("Clerk: User not authenticated");

  const clerk = clerkClient();
  const [{ token: gitlabToken }] = await clerk.users
    .getUserOauthAccessToken(userId, "oauth_gitlab")
    .then(({ data }) => data);

  return new Gitlab({ oauthToken: gitlabToken });
}

export async function getAssignedMergeRequests() {
  try {
    const gitlab = await getGitlabClient();

    const mergeRequests = await gitlab.MergeRequests.all({
      state: "opened",
      scope: "assigned_to_me",
      order_by: "updated_at",
      sort: "desc",
      per_page: 100,
    });

    const detailedMergeRequests = await Promise.all(
      mergeRequests.map(async (mr) => {
        const [project, pipelines] = await Promise.all([
          gitlab.Projects.show(mr.project_id),
          gitlab.MergeRequests.allPipelines(mr.project_id, mr.iid),
        ]);

        const latestPipeline = pipelines[0];
        const buildStatus = latestPipeline ? latestPipeline.status : "unknown";

        return {
          id: mr.id,
          number: mr.iid,
          title: mr.title,
          state: mr.state,
          createdAt: new Date(mr.created_at),
          updatedAt: new Date(mr.updated_at),
          buildStatus,
          isDraft: mr.work_in_progress,
          owner: project.namespace.path,
          repo: project.path,
          branchName: mr.source_branch,
          repository: {
            id: project.id,
            name: project.path,
            full_name: mr.references.full.split('!')[0],
            owner: {
              login: project.namespace.path,
            },
          },
          source: "gitlab",
        };
      })
    );

    return detailedMergeRequests;
  } catch (error) {
    console.error("Error fetching assigned merge requests:", error);
    if (error instanceof Error && error.message.includes("GitLab token expired")) {
      return { error: "GitLab authentication expired. Please re-authenticate." };
    }
    return { error: "Failed to fetch assigned GitLab merge requests" };
  }
}

export async function fetchBuildStatus(projectId: number, mergeRequestIid: number) {
  const gitlab = await getGitlabClient();

  try {
    const mr = await gitlab.MergeRequests.show(projectId, mergeRequestIid);
    const pipelines = await gitlab.MergeRequests.allPipelines(projectId, mergeRequestIid);

    let buildStatus = "pending";
    if (pipelines.length > 0) {
      const latestPipeline = pipelines[0];
      buildStatus = latestPipeline.status;
    }

    return {
      id: mr.id,
      title: mr.title,
      number: mr.iid,
      buildStatus,
      isDraft: mr.work_in_progress,
      branchName: mr.source_branch,
      source: 'gitlab',
      repository: {
        id: mr.project_id,
        name: mr.source_project_id ? mr.source_project_id.toString() : '',
        full_name: mr.references.full.split('!')[0],
        owner: {
          login: mr.references.full.split('/')[0],
        },
      },
    };
  } catch (error) {
    console.error("Error fetching build status:", error);
    throw error;
  }
}

export async function fetchBuildStatusForRef(
  projectId: number,
  ref: string
): Promise<string> {
  const gitlab = await getGitlabClient();

  try {
    const pipelines = await gitlab.Pipelines.all(projectId, {
      ref: ref,
      orderBy: 'id',
      sort: 'desc',
      perPage: 1
    });

    if (pipelines.length === 0) {
      return "pending";
    }

    const latestPipeline = pipelines[0];

    switch (latestPipeline.status) {
      case 'running':
        return "running";
      case 'success':
        return "success";
      case 'failed':
        return "failure";
      case 'canceled':
      case 'skipped':
        return "canceled";
      default:
        return "pending";
    }
  } catch (error) {
    console.error("Error fetching build status for ref:", error);
    return "pending";
  }
}

export async function commitChangesToMergeRequest(
  projectId: number,
  mergeRequestIid: number,
  filesToCommit: TestFile[],
  commitMessage: string
): Promise<string> {
  try {
    const gitlab = await getGitlabClient();

    const mr = await gitlab.MergeRequests.show(projectId, mergeRequestIid);
    const branch = mr.source_branch;

    const actions: CommitAction[] = filesToCommit.map((file) => ({
      action: "update" as const,
      filePath: file.name,
      content: file.content,
    }));

    const commit = await gitlab.Commits.create(
      projectId,
      branch,
      commitMessage,
      actions
    );

    return `https://gitlab.com/${mr.references.full}/commit/${commit.id}`;
  } catch (error) {
    console.error("Error committing changes to merge request:", error);
    if (error instanceof Error && error.message.includes("GitLab token expired")) {
      throw new Error("GitLab authentication expired. Please re-authenticate.");
    }
    throw error;
  }
}

export async function getMergeRequestInfo(
  projectId: number,
  mergeRequestIid: number
) {
  try {
    const gitlab = await getGitlabClient();

    const [mr, diffResponse, repoFiles] = await Promise.all([
      gitlab.MergeRequests.show(projectId, mergeRequestIid),
      gitlab.MergeRequests.allDiffs(projectId, mergeRequestIid),
      gitlab.Repositories.allRepositoryTrees(projectId, { recursive: true }),
    ]);

    const testFiles = await Promise.all(
      repoFiles
        .filter((file) => file.type === "blob" && file.path.toLowerCase().includes(".test."))
        .map(async (file) => {
          const fileContent = await gitlab.RepositoryFiles.show(
            projectId,
            file.path,
            mr.source_branch
          );

          return {
            name: file.path,
            content: Buffer.from(fileContent.content, "base64").toString("utf-8"),
          };
        })
    );

    return {
      diff: diffResponse.map((change) => `${change.diff}`).join("\n"),
      testFiles,
    };
  } catch (error) {
    console.error("Error fetching MR info:", error);
    if (error instanceof Error && error.message.includes("GitLab token expired")) {
      throw new Error("GitLab authentication expired. Please re-authenticate.");
    }
    throw new Error("Failed to fetch MR info");
  }
}

export async function getFailingTests(
  projectId: number,
  mergeRequestIid: number
): Promise<TestFile[]> {
  const gitlab = await getGitlabClient();

  try {
    // Get the latest pipeline for the merge request
    const pipelines = await gitlab.MergeRequests.allPipelines(projectId, mergeRequestIid);
    const latestPipeline = pipelines[0];

    if (!latestPipeline || latestPipeline.status !== 'failed') {
      return [];
    }

    // Fetch jobs related to the latest pipeline using gitlab.Jobs.all
    const jobs = await gitlab.Jobs.all(projectId, { pipelineId: latestPipeline.id });
    
    // Filter failed jobs
    const failedJobs = jobs.filter(job => job.status === 'failed');

    const failingTestFiles: TestFile[] = [];

    // Fetch the logs (trace) for each failed job
    for (const job of failedJobs) {
      try {
        const log = await gitlab.Jobs.showLog(projectId, job.id);
        const logContent = log.toString();

        // Use a regular expression to identify test file names in the logs
        const testFileRegex = /(\S+\.(test|spec)\.\S+)/g;
        const matches = logContent.match(testFileRegex);

        if (matches) {
          // For each matching file, fetch its content
          for (const match of matches) {
            try {
              const fileContent = await gitlab.RepositoryFiles.show(
                projectId,
                match,
                latestPipeline.ref
              );

              failingTestFiles.push({
                name: match,
                content: Buffer.from(fileContent.content, 'base64').toString('utf-8'),
              });
            } catch (error) {
              console.warn(`Failed to fetch content for file: ${match}`, error);
            }
          }
        }
      } catch (logError) {
        console.warn(`Failed to fetch logs for job: ${job.id}`, logError);
      }
    }

    return failingTestFiles;
  } catch (error) {
    console.error('Error fetching failing tests:', error);
    if (error instanceof Error && error.message.includes("GitLab token expired")) {
      throw new Error("GitLab authentication expired. Please re-authenticate.");
    }
    throw error;
  }
}

export async function getWorkflowLogs(projectId: number, pipelineId: string): Promise<string> {
  const gitlab = await getGitlabClient();

  try {
    const jobs = await gitlab.Jobs.all(projectId, { pipelineId: parseInt(pipelineId) });
    
    let logsContent = '';
    for (const job of jobs) {
      const jobLog = await gitlab.Jobs.showLog(projectId, job.id);
      logsContent += `Job: ${job.name} (ID: ${job.id})\n${jobLog}\n\n`;
    }

    return logsContent;
  } catch (error) {
    console.error("Error downloading workflow logs:", error);
    throw new Error(`Failed to download workflow logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getLatestRunId(projectId: number, branchName: string): Promise<string | null> {
  const gitlab = await getGitlabClient();

  try {
    const pipelines = await gitlab.Pipelines.all(projectId, {
      ref: branchName,
      orderBy: 'id',
      sort: 'desc',
      perPage: 1
    });

    if (pipelines.length > 0) {
      return pipelines[0].id.toString();
    }

    return null;
  } catch (error) {
    console.error('Error fetching latest run ID:', error);
    throw error;
  }
}
