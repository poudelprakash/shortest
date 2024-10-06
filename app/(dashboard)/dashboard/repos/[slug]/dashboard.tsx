"use client"

import { useState, useEffect } from 'react'
import { Star, RefreshCw, GitBranch, Github, Menu, X, GitPullRequest } from 'lucide-react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { timeAgo } from '@/utils/timeHelpers'
import { Activity, /* other imports */ } from 'lucide-react';

import { PullRequestItem } from '../../pull-request'

export function RepoDashboard() {
  const { slug } = useParams()
  const searchParams = useSearchParams()
  const provider = searchParams.get('provider')

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [repoData, setRepoData] = useState({
    name: '',
    isStarred: false,
    lastBuildBranch: '',
    lastBuildTime: '',
    fileCount: 0,
    provider: '',
  })
  const [maintainabilityProgress, setMaintainabilityProgress] = useState(0)
  const [testCoverageProgress, setTestCoverageProgress] = useState(0)
  const [openPullRequests, setOpenPullRequests] = useState([])
  const [activeTab, setActiveTab] = useState('Overview')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const response = await fetch(`/api/repositories/${slug}/scan?provider=${provider}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to trigger scan');
      }

      const data = await response.json();
      // Optionally handle the response data
      console.log('Scan initiated:', data);
    } catch (error) {
      console.error('Error triggering scan:', error);
      // Optionally display an error message to the user
    } finally {
      setIsScanning(false);
    }
  };

  const loadData = async (forceRefresh = false) => {
    setIsLoading(true)
    try {
      const repoResponse = await fetch(`/api/repositories/${slug}?provider=${provider}${forceRefresh ? '&refresh=true' : ''}`)

      if (!repoResponse.ok) {
        throw new Error('Failed to fetch repository data')
      }

      const repoData = await repoResponse.json()
      setRepoData(repoData)

      try {
        const prResponse = await fetch(`/api/repositories/${slug}/pull-requests?provider=${provider}`)
        if (prResponse.ok) {
          const prData = await prResponse.json()
          setOpenPullRequests(prData)
        } else {
          console.error('Failed to fetch pull requests')
          setOpenPullRequests([])
        }
      } catch (error) {
        console.error('Error fetching pull requests:', error)
        setOpenPullRequests([])
      }
    } catch (error) {
      console.error('Error fetching repository data:', error)
      // Handle error state here (e.g., set an error message state)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [slug, provider])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadData(true).then(() => {
      setIsRefreshing(false)
    })
  }

  const renderSkeleton = () => (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-40 bg-gray-200 rounded mb-4"></div>
        </div>
        <div>
          <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
          <div className="h-40 bg-gray-200 rounded mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-36 mt-6 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className='hidden'>
        <h2 className="text-xl font-semibold mb-4">Breakdown</h2>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-baseline mb-4">
            <span className="text-5xl font-extrabold text-gray-900 mr-2">{repoData.fileCount}</span>
            <span className="text-gray-500">FILES</span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">MAINTAINABILITY</h3>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-yellow-500 transition-all duration-1000 ease-out"
                style={{ width: `${maintainabilityProgress}%` }}
              ></div>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">TEST COVERAGE</h3>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-1000 ease-out"
                style={{ width: `${testCoverageProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className='hidden'>
        <h2 className="text-xl font-semibold mb-4">Codebase summary</h2>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">MAINTAINABILITY</h3>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center text-white text-2xl font-bold mr-2">
                  C
                </div>
                <span className="text-2xl font-semibold">5 days</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">TEST COVERAGE</h3>
              <div className="w-12 h-12 bg-green-400 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <h2 className="text-xl font-semibold mt-6 mb-4">Repository stats</h2>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">CODE SMELLS</h3>
              <span className="text-3xl font-semibold text-blue-500">8</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">DUPLICATION</h3>
              <span className="text-3xl font-semibold text-blue-500">14</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">OTHER ISSUES</h3>
              <span className="text-3xl font-semibold text-gray-400">0</span>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-1 md:col-span-2 w-full">
        {openPullRequests.length > 0 ? (
          <ul className="space-y-8 w-full">
            {openPullRequests.map((codeChangeRequest) => (
              <li key={codeChangeRequest.id}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">
                    {codeChangeRequest.fullPath}
                  </h3>
                </div>
                <PullRequestItem pullRequest={codeChangeRequest} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <GitPullRequest className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                No pull requests or merge requests found
              </h3>
              <p className="text-gray-600 mb-4">
                We couldn't find any pull requests or merge requests assigned to you.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  )

  const renderRepoSettings = () => (
    <div className="flex flex-col md:flex-row">
      <div className="w-full md:w-1/4 mb-6 md:mb-0 md:pr-8">
        <nav className="space-y-1">
          {['General', 'GitHub', 'Integrations', 'Maintainability', 'Test coverage', 'Plugins', 'Exclude patterns', 'Badges'].map((item) => (
            <a
              key={item}
              href="#"
              className={`block px-3 py-2 text-sm font-medium rounded-md ${item === 'General' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              {item}
            </a>
          ))}
        </nav>
      </div>
      <div className="w-full md:w-3/4">
        <h2 className="text-3xl font-bold mb-6">General</h2>
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">NAME</h3>
          <input
            type="text"
            value={repoData.name}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            readOnly
          />
        </div>
        <button className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">
          Save
        </button>
        <div className="mt-12 border-t pt-8">
          <h3 className="text-2xl font-bold mb-4">Danger zone</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h4 className="text-lg font-medium mb-2">DEFAULT BRANCH <span className="text-red-500">*</span></h4>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
              <input
                type="text"
                value={repoData.lastBuildBranch}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md"
              />
              <button className="w-full sm:w-auto px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">
                Save
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Changing your default branch will impact integrations.<br />
              Please <a href="#" className="text-green-600 hover:underline">read the documentation</a> before updating your default branch.
            </p>
          </div>
          <div className="mt-6">
            <h4 className="text-lg font-medium mb-2">REMOVE REPO</h4>
            <button className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
              Remove Repo
            </button>
            <p className="mt-2 text-sm text-gray-600">This action cannot be undone!</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 sm:py-6 border-b border-gray-200">
          <div className="flex items-center space-x-2 mb-4 sm:mb-0">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800">
              {isLoading ? (
                <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
              ) : (
                <>
                  <Link href={`/dashboard/repos/`} passHref>Repositories</Link>&gt;{repoData.name}
                </>
              )}
            </h1>
            {!isLoading && (
              repoData.provider === 'github' ? (
                <Github className="w-6 h-6 text-gray-600" />
              ) : (
                <GitBranch className="w-6 h-6 text-orange-500" />
              )
            )}
          </div>
          <div className="flex items-center space-x-4">
            {isLoading ? (
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <button
                className={`bg-white border border-gray-300 rounded-md px-3 py-1 flex items-center space-x-1 text-sm ${repoData.isStarred ? 'text-yellow-500' : 'text-gray-600'
                  }`}
                onClick={() => setRepoData(prev => ({ ...prev, isStarred: !prev.isStarred }))}
              >
                <Star className="w-4 h-4" fill={repoData.isStarred ? 'currentColor' : 'none'} />
                <span className="hidden sm:inline">{repoData.isStarred ? 'Starred' : 'Star'}</span>
              </button>
            )}
            {!isLoading && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">

                <div className="relative group">
                  <div
                    // href={`${window.location.href}/builds`}
                    className="border-b border-dashed border-gray-400 hover:border-gray-600"
                  >
                    Synced {timeAgo(repoData.updatedAt)}
                  </div>
                  {/* <div className="absolute left-0 mt-1 w-40 bg-white shadow-lg rounded-md p-2 text-xs invisible group-hover:visible">
                    See recent builds
                  </div> */}
                </div>
              </div>
            )}
            <button
              className="flex items-center text-sm text-gray-600"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            {/* New Scan button */}
            <button
              className="flex items-center text-sm text-gray-600"
              onClick={handleScan}
              disabled={isScanning}
            >
              <Activity className={`w-4 h-4 mr-1 ${isScanning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isScanning ? 'Scanning...' : 'Scan'}</span>
            </button>

            {/* Existing Mobile Menu Button */}


            <button
              className="sm:hidden p-2 text-gray-600"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        <nav className="hidden sm:flex space-x-6 py-4">
          {['Overview', 'Repo Settings'].map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`text-sm ${item === activeTab ? 'text-gray-900 border-b-2 border-green-500' : 'text-gray-600'}`}
            >
              {item}
            </button>
          ))}
        </nav>

        {isLoading || isRefreshing ? renderSkeleton() : (
          <>
            {activeTab === 'Overview' && renderOverview()}
            {activeTab === 'Repo Settings' && renderRepoSettings()}
          </>
        )}
      </div>

      {/* Mobile slide-out menu */}
      <div className={`fixed inset-0 bg-gray-600 bg-opacity-75 z-50 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
            <button
              className="p-2 text-gray-600"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="px-4 py-6">
            {['Overview', 'Repo Settings'].map((item) => (
              <button
                key={item}
                onClick={() => {
                  setActiveTab(item)
                  setIsMobileMenuOpen(false)
                }}
                className={`block w-full text-left px-4 py-2 text-sm ${item === activeTab
                  ? 'text-green-600 bg-green-50 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {item}
              </button>
            ))}
          </nav>
          {!isLoading && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Synced: {timeAgo(repoData.updatedAt)}</span>
                <span className="flex items-center">
                  <GitBranch className="w-4 h-4 mr-1" />
                  {repoData.monitoredBranches[0]}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

