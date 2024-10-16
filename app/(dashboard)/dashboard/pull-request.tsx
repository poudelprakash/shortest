"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitPullRequestDraft,
  GitPullRequest,
  CheckCircle,
  XCircle,
  Edit,
  PlusCircle,
  Loader2,
  AlertCircle,
  Github,
  GitBranch,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import dynamic from "next/dynamic";
import { PullRequest, TestFile } from "./types";
import { useToast } from "@/hooks/use-toast";
import { commitChangesToPullRequest, getPullRequestInfo, getFailingTests } from "@/lib/gitProviderActions";
import { Input } from "@/components/ui/input";
import useSWR from "swr";
import { fetchBuildStatus } from "@/lib/github";
import { experimental_useObject as useObject } from "ai/react";
import { TestFileSchema } from "@/app/api/generate-tests/schema";
import { LogView } from "./log-view";
import { getLatestRunId } from "@/lib/github";
import { cn } from "@/lib/utils";

const ReactDiffViewer = dynamic(() => import("react-diff-viewer"), {
  ssr: false,
});

interface PullRequestItemProps {
  pullRequest: PullRequest;
}

export function PullRequestItem({
  pullRequest: initialPullRequest,
}: PullRequestItemProps) {
  const [optimisticRunning, setOptimisticRunning] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const { data: pullRequest, mutate } = useSWR(
    `pullRequest-${initialPullRequest.id}`,
    () =>
      fetchBuildStatus(
        initialPullRequest.repository.owner.login,
        initialPullRequest.repository.name,
        initialPullRequest.number
      ),
    {
      fallbackData: initialPullRequest,
      refreshInterval: optimisticRunning ? 10000 : 0,
      onSuccess: (data: { buildStatus: string; }) => {
        if (data.buildStatus !== "running" && data.buildStatus !== "pending") {
          setOptimisticRunning(false);
        }
      },
    }
  );

  const { data: latestRunId } = useSWR(
    pullRequest.buildStatus === "success" ||
      pullRequest.buildStatus === "failure"
      ? [
          "latestRunId",
          pullRequest.repository.owner.login,
          pullRequest.repository.name,
          pullRequest.branchName,
        ]
      : null,
    () =>
      getLatestRunId(
        pullRequest.repository.owner.login,
        pullRequest.repository.name,
        pullRequest.branchName
      )
  );

  const [testFiles, setTestFiles] = useState<TestFile[]>([]);
  const [oldTestFiles, setOldTestFiles] = useState<TestFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>(
    {}
  );
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(
    {}
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [commitMessage, setCommitMessage] = useState("Update test files");

  const isRunning = optimisticRunning || pullRequest.buildStatus === "running";
  const isPending = !optimisticRunning && pullRequest.buildStatus === "pending";

  const {
    object,
    submit,
    isLoading: isStreaming,
  } = useObject({
    api: "/api/generate-tests",
    schema: TestFileSchema,
    onFinish: async (result) => {
      const { testFiles: oldTestFiles } = await getPullRequestInfo(
        pullRequest
      );
      const { filteredTestFiles, newSelectedFiles, newExpandedFiles } =
        handleTestFilesUpdate(oldTestFiles, result.object?.tests);
      setTestFiles(filteredTestFiles);
      setSelectedFiles(newSelectedFiles);
      setExpandedFiles(newExpandedFiles);
      setAnalyzing(false);
      setLoading(false);
    },
    onError: (error) => {
      console.error("Error generating test files:", error);
      setError("Failed to generate test files.");
      setAnalyzing(false);
      setLoading(false);
    },
  });

  const handleTests = async (pr: PullRequest, mode: "write" | "update") => {
    setAnalyzing(true);
    setLoading(true);
    setError(null);

    try {
      const { diff, testFiles: oldTestFiles } = await getPullRequestInfo(pr);

      let testFilesToUpdate = oldTestFiles;

      if (mode === "update") {
        const failingTests = await getFailingTests(pr);
        testFilesToUpdate = oldTestFiles.filter(file => 
          failingTests.some(failingFile => failingFile.name === file.name)
        );
      }

      setOldTestFiles(testFilesToUpdate);
      submit({
        mode,
        pr_id: pr.id,
        pr_diff: diff,
        test_files: testFilesToUpdate,
      });
    } catch (error) {
      console.error("Error generating test files:", error);
      setError("Failed to generate test files.");
      setAnalyzing(false);
      setLoading(false);
    }
  };

  const handleTestFilesUpdate = (
    oldTestFiles: TestFile[],
    newTestFiles?: (Partial<TestFile> | undefined)[]
  ) => {
    if (newTestFiles && newTestFiles.length > 0) {
      const filteredTestFiles = newTestFiles
        .filter((file): file is TestFile => file !== undefined)
        .map((file) => {
          const oldFile = oldTestFiles?.find(
            (oldFile) => oldFile.name === file.name
          );
          return {
            ...file,
            oldContent: oldFile ? oldFile.content : "",
          };
        });

      const newSelectedFiles: Record<string, boolean> = {};
      const newExpandedFiles: Record<string, boolean> = {};
      filteredTestFiles.forEach((file) => {
        const fileName = file?.name ?? `file_${Math.random()}`;
        newExpandedFiles[fileName] = true;
        newSelectedFiles[fileName] = true;
      });
      return { filteredTestFiles, newSelectedFiles, newExpandedFiles };
    }
    return {
      filteredTestFiles: [],
      newSelectedFiles: {},
      newExpandedFiles: {},
    };
  };

  const commitChanges = async () => {
    setLoading(true);
    setError(null);

    setOptimisticRunning(true);
    mutate({ ...pullRequest, buildStatus: "running" }, false);

    try {
      const filesToCommit = testFiles
        .filter((file) => selectedFiles[file.name])
        .map((file) => ({
          name: file.name,
          content: file.content,
        }));
  
      const newCommitUrl = await commitChangesToPullRequest(pullRequest, filesToCommit, commitMessage);

      toast({
        title: "Changes committed successfully",
        description: (
          <>
            The test files have been added to the pull request.{" "}
            <Link href={newCommitUrl} className="underline">
              View commit
            </Link>
          </>
        ),
      });

      setTestFiles([]);
      setSelectedFiles({});
      setExpandedFiles({});

      mutate();
    } catch (error) {
      console.error("Error committing changes:", error);
      setError("Failed to commit changes. Please try again.");
      toast({
        title: "Error",
        description: "Failed to commit changes. Please try again.",
        variant: "destructive",
      });

      setOptimisticRunning(false);
      mutate();
    } finally {
      setLoading(false);
    }
  };

  const handleCancelChanges = () => {
    setTestFiles([]);
    setSelectedFiles({});
    setExpandedFiles({});
    setError(null);
  };

  const handleFileToggle = (fileName: string) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [fileName]: !prev[fileName],
    }));
    setExpandedFiles((prev) => ({
      ...prev,
      [fileName]: !prev[fileName],
    }));
  };

  const { filteredTestFiles, newSelectedFiles, newExpandedFiles } =
    handleTestFilesUpdate(oldTestFiles, object?.tests);

  const testFilesToShow = isStreaming ? filteredTestFiles : testFiles;
  const selectedFilesToShow = isStreaming ? newSelectedFiles : selectedFiles;
  const expandedFilesToShow = isStreaming ? newExpandedFiles : expandedFiles;

  return (
    <div className={`bg-white p-4 rounded-lg shadow-md ${pullRequest.source === 'gitlab' ? 'border-l-4 border-orange-500' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center">
          {pullRequest.isDraft ? (
            <GitPullRequestDraft className="mr-2 h-4 w-4 text-gray-400" />
          ) : (
            <GitPullRequest className={`mr-2 h-4 w-4 ${pullRequest.source === 'github' ? '' : 'text-orange-500'}`} />
          )}
          <span className="font-medium">{pullRequest.title}</span>
        </span>
        <div className="flex items-center">
          <Badge 
            variant={pullRequest.source === 'github' ? 'default' : 'warning'}
            className="mr-2"
          >
            {pullRequest.source === 'github' ? (
              <Github className="h-3 w-3 mr-1" />
            ) : (
              <GitBranch className="h-3 w-3 mr-1" />
            )}
            {pullRequest.source === 'github' ? 'GitHub' : 'GitLab'}
          </Badge>
          <Link
            href={`https://${pullRequest.source}.com/${pullRequest.repository.full_name}/${pullRequest.source === 'github' ? 'pull' : 'merge_requests'}/${pullRequest.number}`}
            className="text-sm text-gray-600 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            #{pullRequest.number}
          </Link>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center">
          {isRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-yellow-500" />
          ) : isPending ? (
            <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />
          ) : pullRequest.buildStatus === "success" ? (
            <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="mr-2 h-4 w-4 text-red-500" />
          )}
          <Link
            href={`https://${pullRequest.source}.com/${pullRequest.repository.full_name}/${pullRequest.source === 'github' ? 'pull' : 'merge_requests'}/${pullRequest.number}/checks`}
            className="text-sm underline text-gray-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            Build:{" "}
            {isRunning
              ? "Running"
              : isPending
              ? "Pending"
              : pullRequest.buildStatus}
          </Link>
          {(pullRequest.buildStatus === "success" ||
            pullRequest.buildStatus === "failure") &&
            latestRunId && (
              <button
                className="flex items-center space-x-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors duration-100 ease-in-out"
                onClick={() => setShowLogs(!showLogs)}
              >
                <span>{showLogs ? "Hide Logs" : "Show Logs"}</span>
                <span className="relative w-4 h-4">
                  <ChevronUp
                    className={cn(
                      "absolute inset-0 h-4 w-4 transition-opacity duration-100",
                      showLogs ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <ChevronDown
                    className={cn(
                      "absolute inset-0 h-4 w-4 transition-opacity duration-100",
                      showLogs ? "opacity-0" : "opacity-100"
                    )}
                  />
                </span>
              </button>
            )}
        </span>
        {testFilesToShow.length > 0 ? (
          <Button
            size="sm"
            className="bg-white hover:bg-gray-100 text-black border border-gray-200"
            onClick={handleCancelChanges}
            disabled={loading}
          >
            Cancel
          </Button>
        ) : pullRequest.buildStatus === "success" || isPending ? (
          <Button
            size="sm"
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={() => handleTests(pullRequest, "write")}
            disabled={loading || isRunning}
          >
            {loading || isRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            {loading
              ? "Loading..."
              : isRunning
              ? "Running..."
              : "Write new tests"}
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
            onClick={() => handleTests(pullRequest, "update")}
            disabled={loading || isRunning}
          >
            {loading || isRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Edit className="mr-2 h-4 w-4" />
            )}
            {loading
              ? "Loading..."
              : isRunning
              ? "Running..."
              : "Update tests to fix"}
          </Button>
        )}
      </div>
      {error && (
        <div className="mt-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {(loading || analyzing || testFilesToShow.length > 0) && (
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Test files</h4>
          {testFilesToShow.length > 0 ? (
            <div className="space-y-4">
              {testFilesToShow.map((file) => (
                <div key={file.name} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Checkbox
                        id={file.name}
                        checked={selectedFilesToShow[file.name]}
                        onCheckedChange={() => handleFileToggle(file.name)}
                      />
                      <label
                        htmlFor={file.name}
                        className="ml-2 font-medium cursor-pointer"
                      >
                        {file.name}
                      </label>
                    </div>
                  </div>
                  {expandedFilesToShow[file.name] && (
                    <div className="mt-2">
                      <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
                        <ReactDiffViewer
                          oldValue={file.oldContent || ""}
                          newValue={file.content || ""}
                          splitView={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="mt-4">
                <Input
                  type="text"
                  placeholder="Update test files"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="mb-2"
                />
                <Button
                  className="w-full mt-2 bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={commitChanges}
                  disabled={
                    Object.values(selectedFilesToShow).every(
                      (value) => !value
                    ) ||
                    loading ||
                    !commitMessage.trim()
                  }
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {loading ? "Committing changes..." : "Commit changes"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Analyzing PR diff...</span>
            </div>
          )}
        </div>
      )}
      {showLogs && latestRunId && (
        <div className="mt-4">
          <LogView
            owner={pullRequest.repository.owner.login}
            repo={pullRequest.repository.name}
            runId={latestRunId}
          />
        </div>
      )}
    </div>
  );
}
