// components/RepositoryItem.tsx
import React from 'react';
import { Repository } from '@/app/(dashboard)/repos/types';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Split,
} from 'lucide-react';

interface RepositoryItemProps {
  repository: Repository;
}

const RepositoryItem: React.FC<RepositoryItemProps> = ({ repository }) => {
  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'upToDate':
        return <CheckCircle className="text-green-500" />;
      case 'inProgress':
        return <RefreshCw className="text-yellow-500" />;
      case 'failed':
        return <XCircle className="text-red-500" />;
      case 'outdated':
        return <Clock className="text-gray-500" />;
      default:
        return <AlertCircle className="text-gray-400" />;
    }
  };

  return (
    <div className="bg-white shadow-md rounded-md p-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="font-semibold text-lg">{repository.name}</div>
        <div className="text-sm text-gray-500">Last synced: {repository.lastSynced.toLocaleString()}</div>
      </div>

      <div className="flex items-center space-x-4">
        <div>{renderStatusIcon(repository.testGenerationStatus)}</div>
        <div>
          PRs: <span className="font-semibold">{repository.openPullRequests}</span>
        </div>
        <div>
          Coverage: <span className="font-semibold">{repository.pullRequestCoverage}%</span>
        </div>
        <div>
          Code Coverage: <span className="font-semibold">{repository.codeCoverage}%</span>
        </div>
        <div>
          <Split className="inline-block" /> Branches: {repository.monitoredBranches.length}
        </div>
      </div>
    </div>
  );
};

export default RepositoryItem;
