export interface Repository {
    id: string;
    name: string;
    lastSynced: Date;
    testGenerationStatus: 'upToDate' | 'inProgress' | 'failed' | 'outdated';
    openPullRequests: number;
    pullRequestCoverage: number; // percentage
    codeCoverage: number; // percentage
    lastTestGenerationTime: Date;
    testGenerationErrors?: string[];
    actionRequired?: ActionRequired[];
    configurationStatus: 'configured' | 'partiallyConfigured' | 'notConfigured';
    monitoredBranches: string[];
    recentActivity: Activity[];
    userRole: 'admin' | 'contributor' | 'viewer';
  }
  
  export interface ActionRequired {
    type: 'authentication' | 'configuration' | 'manualIntervention';
    message: string;
  }
  
  export interface Activity {
    message: string;
    timestamp: Date;
  }