// components/RepositoryList.tsx
import React, { useState, useEffect } from 'react';
import RepositoryItem from './RepositoryItem';
import SearchFilterBar from './SearchFilterBar';
import { Repository } from '@/app/(dashboard)/repos/types';
import SkeletonRepositoryItem from './SkeletonRepositoryItem';

interface RepositoryListProps {
  repositories: Repository[];
}

const RepositoryList: React.FC<RepositoryListProps> = ({ repositories }) => {
  const [visibleRepositories, setVisibleRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const repositoriesPerPage = 10; // Define how many repositories to load per "scroll"

  useEffect(() => {
    loadRepositories();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadRepositories = () => {
    if (isLoading) return;

    setIsLoading(true);

    setTimeout(() => {
      const start = (page - 1) * repositoriesPerPage;
      const end = start + repositoriesPerPage;
      const newRepositories = repositories.slice(start, end);

      if (newRepositories.length > 0) {
        setVisibleRepositories((prev) => [...prev, ...newRepositories]);
        setPage((prevPage) => prevPage + 1);
      } else {
        setHasMore(false);
      }
      setIsLoading(false);
    }, 1000); // Simulate loading delay for demo purposes
  };

  const handleScroll = () => {
    if (
      window.innerHeight + document.documentElement.scrollTop !==
        document.documentElement.offsetHeight ||
      isLoading ||
      !hasMore
    )
      return;
    loadRepositories();
  };

  return (
    <div className="p-4">
      {/* <SearchFilterBar searchTerm="" onSearch={() => {}} /> */}
      <div className="grid grid-cols-1 gap-4">
        {visibleRepositories.map((repo) => (
          <RepositoryItem key={repo.id} repository={repo} />
        ))}
        {isLoading && (
          <>
            <SkeletonRepositoryItem />
            <SkeletonRepositoryItem />
            <SkeletonRepositoryItem />
          </>
        )}
        {!hasMore && <p className="text-center text-gray-500 mt-4">No more repositories</p>}
      </div>
    </div>
  );
};

export default RepositoryList;
