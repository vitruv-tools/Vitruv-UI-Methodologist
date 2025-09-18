import { AuthService } from './auth';
import { FlowData } from '../types/flow';
import { ApiResponse, Vsum, VsumDetails } from '../types/vsum';

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
        try {
          await AuthService.refreshToken();
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
              let retryErrorText = '';
              try {
                retryErrorText = await retryResponse.text();
              } catch {}
              let retryErrorMessage = retryErrorText;
              try {
                const parsed = JSON.parse(retryErrorText);
                retryErrorMessage = parsed?.message || parsed?.error || retryErrorText;
              } catch {}
              console.error('Request failed after token refresh', {
                url,
                method: options.method || 'GET',
                status: retryResponse.status,
                statusText: retryResponse.statusText,
                message: retryErrorMessage,
                body: retryErrorText,
              });
              throw new Error(retryErrorMessage);
            }

            return await retryResponse.json();
          }
        } catch (refreshError) {
          console.error('Token refresh failed during request:', refreshError);
        }
      }
      let errorText = '';
      try {
        errorText = await response.text();
      } catch {}
      let errorMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed?.message || parsed?.error || errorText;
      } catch {}
      console.error('Request failed', {
        url,
        method: options.method || 'GET',
        status: response.status,
        statusText: response.statusText,
        message: errorMessage,
        body: errorText,
      });
      throw new Error(errorMessage);
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
      let errorText = '';
      try {
        errorText = await response.text();
      } catch {}
      let errorMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed?.message || parsed?.error || errorText;
      } catch {}
      console.error('Public request failed', {
        url,
        method: options.method || 'GET',
        status: response.status,
        statusText: response.statusText,
        message: errorMessage,
        body: errorText,
      });
      throw new Error(errorMessage);
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
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    console.log(`Response status: ${response.status} for upload type ${type}`);

    if (!response.ok) {
      if (response.status === 401) {
        try {
          await AuthService.refreshToken();
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
              let retryErrorText = '';
              try {
                retryErrorText = await retryResponse.text();
              } catch {}
              let retryErrorMessage = retryErrorText;
              try {
                const parsed = JSON.parse(retryErrorText);
                retryErrorMessage = parsed?.message || parsed?.error || retryErrorText;
              } catch {}
              console.error('Upload failed after token refresh', {
                url,
                type,
                status: retryResponse.status,
                statusText: retryResponse.statusText,
                message: retryErrorMessage,
                body: retryErrorText,
              });
              throw new Error(retryErrorMessage);
            }

            const result = await retryResponse.json();
            console.log(`Successful upload for type ${type}:`, result);
            return result;
          }
        } catch (refreshError) {
          console.error('Token refresh failed during upload:', refreshError);
        }
      }
      let errorText = '';
      try {
        errorText = await response.text();
      } catch {}
      let errorMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed?.message || parsed?.error || errorText;
      } catch {}
      console.error('Upload failed', {
        url,
        type,
        status: response.status,
        statusText: response.statusText,
        message: errorMessage,
        body: errorText,
      });
      throw new Error(errorMessage);
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
    pageNumber?: number;
    pageSize?: number;
  }): Promise<{ data: any[]; message: string }> {
    // Set default values for pagination
    const pageNumber = filters.pageNumber ?? 0;
    const pageSize = filters.pageSize ?? 50;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
    });
    
    const endpoint = `/api/v1/meta-models/find-all?${queryParams.toString()}`;
    
    console.log('findMetaModels request:', {
      endpoint,
      filters,
      pageNumber,
      pageSize,
    });
    
    const result = await this.authenticatedRequest<{ data: any[]; message: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(filters),
    });
    
    console.log('findMetaModels response:', result);
    
    return result;
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
   * vSUMS: Get all
   */
  async getVsums(): Promise<ApiResponse<Vsum[]>> {
    return this.authenticatedRequest('/api/v1/vsums/find-all');
  }

  /**
   * vSUMS: Create
   */
  async createVsum(data: { name: string }): Promise<ApiResponse<Vsum>> {
    return this.authenticatedRequest('/api/v1/vsums', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * vSUMS: Update name and meta model links
   */
  async updateVsum(id: number | string, data: { name: string; metaModelIds: number[] }): Promise<ApiResponse<any>> {
    return this.authenticatedRequest(`/api/v1/vsums/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * vSUMS: Get details
   */
  async getVsumDetails(id: number | string): Promise<ApiResponse<VsumDetails>> {
    return this.authenticatedRequest(`/api/v1/vsums/${id}/details`);
  }

  /**
   * vSUMS: Get by id
   */
  async getVsum(id: number | string): Promise<ApiResponse<Vsum>> {
    return this.authenticatedRequest(`/api/v1/vsums/${id}`);
  }

  /**
   * vSUMS: Delete
   */
  async deleteVsum(id: number | string): Promise<ApiResponse<Record<string, never>>> {
    return this.authenticatedRequest(`/api/v1/vsums/${id}`, {
      method: 'DELETE',
    });
  }

  // Removed unused getBaseURL and setBaseURL helpers
}

// Export a singleton instance
export const apiService = new ApiService();

// Example API methods using the authenticated service
// Removed unused userApi and projectApi helpers

// Export the class for testing or custom instances
export { ApiService }; 