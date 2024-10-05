"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GitBranch, User, RefreshCw, GitPullRequest } from 'lucide-react';
import { timeAgo } from '@/utils/timeHelpers'

type Repository = {
  id: string;
  name: string;
  lastSynced: Date;
  maintainability: number;
  testCoverage: number;
  monitoredBranches: string[];
  lastCommit: Date;
  updatedAt: Date;
  userRole: 'admin' | 'contributor';
  openPullRequests: number;
};

const SkeletonLoader: React.FC = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
    <div className="h-20 bg-gray-200 rounded mb-4"></div>
    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
  </div>
);

interface RepositoryCardProps {
  repo: Repository;
  onRefresh: (id: string) => void;
  isRefreshing: boolean;
}

const RepositoryCard: React.FC<RepositoryCardProps> = ({ repo, onRefresh, isRefreshing }) => {
  const renderBranches = (branches: string[]): JSX.Element => {
    const maxDisplayBranches = 2;
    if (branches.length <= maxDisplayBranches) {
      return <>{branches.join(', ')}</>;
    }
    const displayedBranches = branches.slice(0, maxDisplayBranches);
    const remainingCount = branches.length - maxDisplayBranches;
    return (
      <>
        {displayedBranches.join(', ')}{' '}&nbsp;
        <span className="border-b border-dashed border-gray-400 hover:border-gray-600 cursor-pointer">
          +{remainingCount} branch{remainingCount > 1 ? 'es' : ''}
        </span>
      </>
    );
  };

  return (
    <Link href={`/dashboard/repos/${repo.id}/?provider=${repo.provider}`} passHref>
      <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold">{repo.name}</h2>
            <p className="text-sm text-gray-500">
              Last synced: {timeAgo(repo.updatedAt)}
            </p>
          </div>
          <button
            className="flex items-center text-sm text-gray-600"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              onRefresh(repo.id);
            }}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {isRefreshing ? (
          <SkeletonLoader />
        ) : (
          <>
            <div className="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">
              <div className="mt-2">
                <h3 className="text-xs font-medium text-gray-500 mb-1">MAINTAINABILITY</h3>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-yellow-500 transition-all duration-1000 ease-out"
                    style={{ width: `${repo.maintainability}%` }}
                  ></div>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-xs font-medium text-gray-500 mb-1">TEST COVERAGE</h3>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-1000 ease-out"
                    style={{ width: `${repo.testCoverage}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="text-sm">
              <p className="mb-2 flex items-center">
                <GitBranch size={16} className="mr-1" />
                {renderBranches(repo.monitoredBranches)}
              </p>
              <p className="mb-2 flex items-center">
                <GitPullRequest size={16} className="mr-1" />
                {repo.openPullRequests} open PR{repo.openPullRequests !== 1 ? 's' : ''}
              </p>
              <p className="flex items-center">
                <User size={16} className="mr-1" />
                <span className="capitalize">{repo.userRole}</span>
              </p>
            </div>
          </>
        )}
      </div>
    </Link>
  );
};

const RepositoryList: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [refreshingRepos, setRefreshingRepos] = useState<string[]>([]);
  const [isGlobalRefreshing, setIsGlobalRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchRepositories = async (forceRefresh: boolean = false) => {
    try {
      setIsGlobalRefreshing(true);
      const response = await fetch(`/api/repositories${forceRefresh ? '?refresh=true' : ''}`);
      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }
      const data = await response.json();
      setRepositories(data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch repositories. Please try again.");
    } finally {
      setIsGlobalRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositories();
  }, []);

  const handleRefresh = (id: string): void => {
    setRefreshingRepos(prev => [...prev, id]);
    setTimeout(() => {
      setRepositories(prev => prev.map(repo => 
        repo.id === id ? {...repo} : repo
      ));
      setRefreshingRepos(prev => prev.filter(repoId => repoId !== id));
    }, 2000);
  };

  const handleGlobalRefresh = (): void => {
    fetchRepositories(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Repositories {(repositories.length > 0)? `[${repositories.length}]` : ''}</h1>
        <div className="flex items-center text-sm text-gray-600">
          {/* <span className="mr-4">Last synced: {(new Date('2024-10-05T09:45:00')).toLocaleString()}</span> */}
          <button
            className="flex items-center text-sm text-gray-600"
            onClick={handleGlobalRefresh}
            disabled={isGlobalRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isGlobalRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isGlobalRefreshing ? 'Refreshing...' : 'Refresh'}
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          // Display skeleton loaders while loading
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="bg-white shadow-md rounded-lg p-6">
              <SkeletonLoader />
            </div>
          ))
        ) : (
          repositories.map((repo) => (
            <RepositoryCard
              key={repo.id}
              repo={repo}
              onRefresh={handleRefresh}
              isRefreshing={isGlobalRefreshing || refreshingRepos.includes(repo.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default RepositoryList;
