import { AuthService } from './auth';
import { FlowData } from '../types/flow';

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = 'http://localhost:9811';
  }

  /**
   * Make an authenticated API request with automatic token refresh
   */
  async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Ensure we have a valid token
    const token = await AuthService.ensureValidToken();
    
    if (!token) {
      throw new Error('No valid authentication token available');
    }

    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be invalid, try to refresh
        try {
          await AuthService.refreshToken();
          // Retry the request with the new token
          const newToken = await AuthService.ensureValidToken();
          if (newToken) {
            const retryResponse = await fetch(url, {
              ...options,
              headers: {
                ...headers,
                'Authorization': `Bearer ${newToken}`,
              },
            });

            if (!retryResponse.ok) {
              throw new Error(`HTTP error! status: ${retryResponse.status}`);
            }

            return await retryResponse.json();
          }
        } catch (refreshError) {
          console.error('Token refresh failed during request:', refreshError);
          // If refresh fails, the user will be signed out by the auth service
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Make a public API request (no authentication required)
   */
  async publicRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Deploy a flow
   */
  async deployFlow(flowData: FlowData): Promise<{ success: boolean; message: string }> {
    return this.authenticatedRequest('/api/v1/flows/deploy', {
      method: 'POST',
      body: JSON.stringify(flowData),
    });
  }

  /**
   * Save a flow
   */
  async saveFlow(flowData: FlowData, flowId?: string): Promise<{ id: string; success: boolean }> {
    const endpoint = flowId ? `/api/v1/flows/${flowId}` : '/api/v1/flows';
    const method = flowId ? 'PUT' : 'POST';
    
    return this.authenticatedRequest(endpoint, {
      method,
      body: JSON.stringify(flowData),
    });
  }

  /**
   * Load a flow by ID
   */
  async loadFlow(flowId: string): Promise<FlowData> {
    return this.authenticatedRequest(`/api/v1/flows/${flowId}`);
  }

  /**
   * List all flows
   */
  async listFlows(): Promise<{ id: string; name: string; createdAt: string }[]> {
    return this.authenticatedRequest('/api/v1/flows');
  }

  /**
   * Delete a flow
   */
  async deleteFlow(flowId: string): Promise<{ success: boolean }> {
    return this.authenticatedRequest(`/api/v1/flows/${flowId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Upload a file with type parameter
   */
  async uploadFile(file: File, type: 'ECORE' | 'GEN_MODEL' | 'REACTION'): Promise<{ data: string; message: string }> {
    const token = await AuthService.ensureValidToken();
    
    if (!token) {
      throw new Error('No valid authentication token available');
    }

    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseURL}/api/upload/type=${type}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      // Don't set Content-Type for FormData, let the browser set it with boundary
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    console.log(`Response status: ${response.status} for upload type ${type}`);

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be invalid, try to refresh
        try {
          await AuthService.refreshToken();
          // Retry the request with the new token
          const newToken = await AuthService.ensureValidToken();
          if (newToken) {
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${newToken}`,
              },
              body: formData,
            });

            if (!retryResponse.ok) {
              throw new Error(`HTTP error! status: ${retryResponse.status}`);
            }

            const result = await retryResponse.json();
            console.log(`Successful upload for type ${type}:`, result);
            return result;
          }
        } catch (refreshError) {
          console.error('Token refresh failed during upload:', refreshError);
          // If refresh fails, the user will be signed out by the auth service
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Successful upload for type ${type}:`, result);
    return result;
  }

  /**
   * Create a meta model
   */
  async createMetaModel(data: {
    name: string;
    description: string;
    domain: string;
    keyword: string[];
    ecoreFileId: number;
    genModelFileId: number;
  }): Promise<{ data: any; message: string }> {
    return this.authenticatedRequest('/api/v1/meta-models', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get all meta models
   */
  async getMetaModels(): Promise<{ data: any[]; message: string }> {
    return this.authenticatedRequest('/api/v1/meta-models');
  }

  /**
   * Find meta models with filters
   */
  async findMetaModels(filters: {
    name?: string;
    description?: string;
    domain?: string;
    keyword?: string[];
    ecoreFileId?: number;
    genModelFileId?: number;
    createdFrom?: string;
    createdTo?: string;
  }): Promise<{ data: any[]; message: string }> {
    return this.authenticatedRequest('/api/v1/meta-models/find-all', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  }

  /**
   * Get a specific meta model by ID
   */
  async getMetaModel(id: string): Promise<{ data: any; message: string }> {
    return this.authenticatedRequest(`/api/v1/meta-models/${id}`);
  }

  /**
   * Update a meta model
   */
  async updateMetaModel(id: string, data: {
    name?: string;
    description?: string;
    domain?: string;
    keyword?: string[];
  }): Promise<{ data: any; message: string }> {
    return this.authenticatedRequest(`/api/v1/meta-models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a meta model
   */
  async deleteMetaModel(id: string): Promise<{ data: any; message: string }> {
    return this.authenticatedRequest(`/api/v1/meta-models/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get the current base URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Set a new base URL
   */
  setBaseURL(url: string): void {
    this.baseURL = url;
  }
}

// Export a singleton instance
export const apiService = new ApiService();

// Example API methods using the authenticated service
export const userApi = {
  // Get current user profile
  getProfile: () => apiService.authenticatedRequest('/api/v1/users/profile'),
  
  // Update user profile
  updateProfile: (data: any) => apiService.authenticatedRequest('/api/v1/users/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // Get user settings
  getSettings: () => apiService.authenticatedRequest('/api/v1/users/settings'),
};

export const projectApi = {
  // Get user's projects
  getProjects: () => apiService.authenticatedRequest('/api/v1/projects'),
  
  // Create a new project
  createProject: (data: any) => apiService.authenticatedRequest('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Get project by ID
  getProject: (id: string) => apiService.authenticatedRequest(`/api/v1/projects/${id}`),
  
  // Update project
  updateProject: (id: string, data: any) => apiService.authenticatedRequest(`/api/v1/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // Delete project
  deleteProject: (id: string) => apiService.authenticatedRequest(`/api/v1/projects/${id}`, {
    method: 'DELETE',
  }),
};

// Export the class for testing or custom instances
export { ApiService }; 