// components/SkeletonRepositoryItem.tsx
import React from 'react';

const SkeletonRepositoryItem: React.FC = () => {
  return (
    <div className="bg-white shadow-md rounded-md p-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="h-6 w-40 bg-gray-300 rounded"></div>
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
          <div className="h-4 w-8 bg-gray-200 rounded"></div>
          <div className="h-4 w-12 bg-gray-200 rounded"></div>
          <div className="h-4 w-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonRepositoryItem;
