"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { GitBranch, User, RefreshCw, GitPullRequest } from 'lucide-react';

type Repository = {
  id: string;
  name: string;
  lastSynced: Date;
  maintainability: number;
  testCoverage: number;
  monitoredBranches: string[];
  lastCommit: Date;
  userRole: 'admin' | 'contributor';
  openPullRequests: number;
};

const initialRepositories: Repository[] = [
  {
    id: '1',
    name: 'Repo One',
    lastSynced: new Date('2024-10-05T10:02:20'),
    maintainability: 80,
    testCoverage: 75,
    monitoredBranches: ['main', 'dev'],
    lastCommit: new Date('2024-10-04T15:30:00'),
    userRole: 'admin',
    openPullRequests: 3,
  },
  {
    id: '2',
    name: 'Repo Two',
    lastSynced: new Date('2024-10-05T10:02:20'),
    maintainability: 60,
    testCoverage: 70,
    monitoredBranches: ['main'],
    lastCommit: new Date('2024-10-05T09:45:00'),
    userRole: 'contributor',
    openPullRequests: 1,
  },
  {
    id: '3',
    name: 'Repo Three',
    lastSynced: new Date('2024-10-05T10:02:20'),
    maintainability: 75,
    testCoverage: 82,
    monitoredBranches: ['main', 'dev', 'feature-a', 'feature-b', 'feature-c', 'feature-d', 'feature-e', 'feature-f', 'feature-g', 'feature-h', 'feature-i', 'feature-j', 'feature-k', 'feature-l'],
    lastCommit: new Date('2024-10-05T08:15:00'),
    userRole: 'admin',
    openPullRequests: 5,
  },
];

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
    <Link href={`/dashboard/repos/${repo.id}`} passHref>
      <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold">{repo.name}</h2>
            <p className="text-sm text-gray-500">
              Last synced: {repo.lastSynced.toLocaleString()}
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
                    style={{width: `${repo.maintainability}%`}}
                  ></div>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-xs font-medium text-gray-500 mb-1">TEST COVERAGE</h3>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-1000 ease-out" 
                    style={{width: `${repo.testCoverage}%`}}
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
  const [repositories, setRepositories] = useState<Repository[]>(initialRepositories);
  const [refreshingRepos, setRefreshingRepos] = useState<string[]>([]);
  const [isGlobalRefreshing, setIsGlobalRefreshing] = useState<boolean>(false);

  const handleRefresh = (id: string): void => {
    setRefreshingRepos(prev => [...prev, id]);
    setTimeout(() => {
      setRepositories(prev => prev.map(repo => 
        repo.id === id ? {...repo, lastSynced: new Date()} : repo
      ));
      setRefreshingRepos(prev => prev.filter(repoId => repoId !== id));
    }, 2000);
  };

  const handleGlobalRefresh = (): void => {
    setIsGlobalRefreshing(true);
    setTimeout(() => {
      setRepositories(prev => prev.map(repo => ({...repo, lastSynced: new Date()})));
      setIsGlobalRefreshing(false);
    }, 2000);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Repositories</h1>
        <button 
          className="flex items-center text-sm text-gray-600"
          onClick={handleGlobalRefresh}
          disabled={isGlobalRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${isGlobalRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isGlobalRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {repositories.map((repo) => (
          <RepositoryCard 
            key={repo.id} 
            repo={repo} 
            onRefresh={handleRefresh}
            isRefreshing={isGlobalRefreshing || refreshingRepos.includes(repo.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default RepositoryList;