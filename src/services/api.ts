import { AuthService } from './auth';
import { FlowData } from '../types/flow';
import { ApiResponse, Vsum, VsumDetails } from '../types/vsum';
import { config } from '../config/environment';

class ApiService {
  private readonly baseURL = config.apiBaseUrl;

  /**
   * Parse backend error payload safely
   */
  private parseErrorPayload(errorText: string): Record<string, any> {
    if (!errorText) return {};
    try {
      const parsed = JSON.parse(errorText);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * Extract error message from response text
   */
  private extractErrorMessage(errorText: string): string {
    try {
      const parsed = JSON.parse(errorText);
      return parsed?.message || parsed?.error || errorText;
    } catch {
      return errorText;
    }
  }

  /**
   * Build an Error that keeps backend payload on response.data
   */
  private createApiError(errorText: string, fallbackMessage: string, status?: number): Error & { status?: number; response?: { status?: number; data: any } } {
    const parsed = this.parseErrorPayload(errorText);
    const message =
      (typeof parsed?.message === 'string' && parsed.message) ||
      (typeof parsed?.error === 'string' && parsed.error) ||
      this.extractErrorMessage(errorText) ||
      fallbackMessage;

    const err = new Error(message) as Error & { status?: number; response?: { status?: number; data: any } };
    err.status = status;
    err.response = {
      status,
      data: Object.keys(parsed).length > 0
        ? parsed
        : {
          error: fallbackMessage,
          message: message || fallbackMessage,
        },
    };
    return err;
  }

  /**
   * Ensure a successful artifact response is a ZIP blob (not JSON error text).
   */
  private async parseArtifactBlob(response: Response): Promise<Blob> {
    const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? '';
    if (contentType.includes('json')) {
      const errorText = await response.text();
      throw this.createApiError(errorText, 'Artifact download failed');
    }

    const blob = await response.blob();

    if (blob.type?.toLowerCase().includes('json')) {
      throw this.createApiError(await blob.text(), 'Artifact download failed');
    }

    if (!blob.size) {
      throw this.createApiError('', 'Artifact download returned an empty file');
    }

    const header = new Uint8Array(await new Response(blob.slice(0, 4)).arrayBuffer());
    if (header[0] !== 0x50 || header[1] !== 0x4b) {
      const preview = await blob.slice(0, 512).text();
      throw this.createApiError(preview, 'Artifact download did not return a valid ZIP file');
    }

    return blob;
  }

  /**
   * Safely read response text
   */
  private async getResponseText(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }

  /**
   * Handle failed response by logging and throwing
   */
  private async handleFailedResponse(
    response: Response,
    url: string,
    method: string,
    context: string
  ): Promise<never> {
    const errorText = await this.getResponseText(response);
    console.error(context, { status: response.status });
    throw this.createApiError(errorText, `${method} ${url} failed`, response.status);
  }

  /**
   * Attempt to retry request with refreshed token
   */
  private async retryWithRefreshedToken<T>(
    url: string,
    options: RequestInit,
    headers: Record<string, string>
  ): Promise<T | null> {
    try {
      await AuthService.refreshToken();
      const newToken = await AuthService.ensureValidToken();
      if (!newToken) {
        return null;
      }

      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          'Authorization': `Bearer ${newToken}`,
        },
      });

      if (!retryResponse.ok) {
        await this.handleFailedResponse(retryResponse, url, options.method || 'GET', 'Request failed after token refresh');
      }

      return await retryResponse.json();
    } catch {
      console.error('Token refresh failed during request');
      return null;
    }
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.ok) {
      // 204 No Content or empty body (common for DELETE) — skip JSON parsing
      if (response.status === 204) return null as T;
      const text = await response.text();
      return text ? JSON.parse(text) as T : null as T;
    }

    const isOtpEndpoint = endpoint.includes('/verify-otp') || endpoint.includes('/resend-otp');

    // Some backends return 401 for OTP business errors (e.g., wrong code).
    // For OTP endpoints, do not trigger refresh/signout flow on 401.
    if (response.status === 401 && !isOtpEndpoint) {
      const retryResult = await this.retryWithRefreshedToken<T>(url, options, headers);
      if (retryResult !== null) {
        return retryResult;
      }
    }

    return this.handleFailedResponse(response, url, options.method || 'GET', 'Request failed');
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
      } catch { }
      console.error('Public request failed', { status: response.status });
      throw this.createApiError(errorText, `Public request failed (${response.status})`);
    }

    return await response.json();
  }

  /**
   * Get currently authenticated user info
   */
  async getUserInfo(): Promise<{ data: { id: number; email: string; firstName: string; lastName: string; emailVerified?: boolean; verified?: boolean }; message: string | null }> {
    return this.authenticatedRequest('/api/v1/users');
  }

  /**
   * Update user name — PUT /api/v1/users/{id}
   */
  async updateUserName(userId: string, firstName: string, lastName: string): Promise<{ message: string }> {
    return this.authenticatedRequest(`/api/v1/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ firstName, lastName }),
    });
  }

  /**
   * Change user password
   */
  async changePassword(password: string): Promise<{ data: any; message: string }> {
    return this.authenticatedRequest('/api/v1/users/change-password', {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
  }

  /**
   * Forgot password - sends new password to user's email
   */
  async forgotPassword(email: string): Promise<{ data: any; message: string }> {
    return this.publicRequest('/api/v1/users/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Verify OTP code after registration
   */
  async verifyOtp(inputCode: string): Promise<{ data: any; message: string }> {
    return this.authenticatedRequest('/api/v1/users/verify-otp', {
      method: 'PUT',
      body: JSON.stringify({ inputCode }),
    });
  }

  /**
   * Resend OTP code
   */
  async resendOtp(): Promise<{ data: any; message: string }> {
    return this.authenticatedRequest('/api/v1/users/resend-otp', {
      method: 'GET',
    });
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
   * Get a file by ID - returns file content directly as text
   */
  async getFile(id: number | string): Promise<string> {
    const token = await AuthService.ensureValidToken();

    if (!token) {
      throw new Error('No valid authentication token available');
    }

    const url = `${this.baseURL}/api/files/${id}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        try {
          await AuthService.refreshToken();
          const newToken = await AuthService.ensureValidToken();
          if (newToken) {
            const retryResponse = await fetch(url, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${newToken}`,
              },
            });

            if (!retryResponse.ok) {
              throw new Error(`Failed to fetch file: ${retryResponse.statusText}`);
            }

            return await retryResponse.text();
          }
        } catch {
          console.error('Token refresh failed during file fetch');
        }
      }
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Upload a file with type parameter
   */
  /**
   * Handle failed upload response by logging and throwing
   */
  private async handleFailedUpload(
    response: Response,
    url: string,
    type: string,
    context: string
  ): Promise<never> {
    const errorText = await this.getResponseText(response);
    console.error(context, { status: response.status });
    throw new Error(this.extractErrorMessage(errorText));
  }

  /**
   * Attempt to retry upload with refreshed token
   */
  private async retryUploadWithRefreshedToken(
    url: string,
    formData: FormData,
    type: string
  ): Promise<{ data: string; message: string } | null> {
    try {
      await AuthService.refreshToken();
      const newToken = await AuthService.ensureValidToken();
      if (!newToken) {
        return null;
      }

      const retryResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${newToken}`,
        },
        body: formData,
      });

      if (!retryResponse.ok) {
        await this.handleFailedUpload(retryResponse, url, type, 'Upload failed after token refresh');
      }

      return await retryResponse.json();
    } catch {
      console.error('Token refresh failed during upload');
      return null;
    }
  }

  async uploadFile(file: File, type: 'ECORE' | 'GEN_MODEL' | 'REACTION'): Promise<{ data: string; message: string }> {
    const token = await AuthService.ensureValidToken();

    if (!token) {
      throw new Error('No valid authentication token available');
    }

    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseURL}/api/upload/type=${type}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 401) {
      const retryResult = await this.retryUploadWithRefreshedToken(url, formData, type);
      if (retryResult !== null) {
        return retryResult;
      }
    }

    return this.handleFailedUpload(response, url, type, 'Upload failed');
  }

  /**
   * Create a meta model
   * Backend expects a JSON body: { name, description, domain, keyword, ecoreFileId, genModelFileId, applyGenModelFixes }
   */
  async createMetaModel(data: {
    name: string;
    description: string;
    domain: string;
    keyword: string[];
    ecoreFileId: number;
    genModelFileId: number;
    applyGenModelFixes?: boolean;
  }): Promise<{ data: any; message: string }> {
    const body = {
      ...data,
      applyGenModelFixes: data.applyGenModelFixes ?? false,
    };
    return this.authenticatedRequest('/api/v1/meta-models', {
      method: 'POST',
      body: JSON.stringify(body),
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
    ownedByUser?: boolean;
  }): Promise<{ data: any[]; message: string }> {
    const { pageNumber = 0, pageSize = 50, ...filterBody } = filters;

    const queryParams = new URLSearchParams({
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
    });

    const endpoint = `/api/v1/meta-models/find-all?${queryParams.toString()}`;

    const result = await this.authenticatedRequest<{ data: unknown; message?: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(filterBody),
    });

    let data: any[] = [];
    if (Array.isArray(result?.data)) {
      data = result.data;
    } else if (result?.data && typeof result.data === 'object' && Array.isArray((result.data as { content?: unknown[] }).content)) {
      data = (result.data as { content: any[] }).content;
    }

    return { data, message: result?.message ?? '' };
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
    ecoreFileId?: number;
    genModelFileId?: number;
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
   * Delete a file by ID
   */
  async deleteFile(id: number): Promise<{ data: any; message: string }> {
    return this.authenticatedRequest(`/api/v1/files/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * vSUMS: Get all
   */
  async getVsumsPaginated(
    name: string = '',
    pageNumber: number = 0,
    pageSize: number = 10
  ): Promise<ApiResponse<Vsum[]>> {
    const query = new URLSearchParams({
      name,
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
    });
    return this.authenticatedRequest(`/api/v1/vsums/find-all?${query.toString()}`);
  }

  /**
   * vSUMS: Get all removed (trash)
   */
  async getRemovedVsumsPaginated(
    pageNumber: number = 0,
    pageSize: number = 50
  ): Promise<ApiResponse<Vsum[]>> {
    const query = new URLSearchParams({
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
    });
    return this.authenticatedRequest(`/api/v1/vsums/find-all-removed?${query.toString()}`);
  }

  /**
   * vSUMS: Check if VSUM is buildable / trigger buildOrThrow
   * GET /api/v1/vsums/{id}/build/check
   */
  async buildVsum(id: number | string): Promise<ApiResponse<Record<string, never>>> {
    return this.authenticatedRequest(`/api/v1/vsums/${id}/build/check`, {
      method: 'GET',
    });
  }

  /**
   * vSUMS: Download artifact as ZIP file
   * GET /api/v1/vsums/{id}/build/artifact
   * Returns a ZIP file blob containing the build artifact
   */
  async downloadVsumArtifact(id: number | string): Promise<Blob> {
    const token = await AuthService.ensureValidToken();

    if (!token) {
      throw new Error('No valid authentication token available');
    }

    const url = `${this.baseURL}/api/v1/vsums/${id}/build/artifact`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/zip, application/octet-stream, */*',
    };

    let response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (response.status === 401) {
      try {
        await AuthService.refreshToken();
      } catch {
        console.error('Token refresh failed during artifact download');
      }

      const newToken = await AuthService.ensureValidToken();
      if (newToken) {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            ...headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      }
    }

    if (!response.ok) {
      const errorText = await this.getResponseText(response);
      console.error('Artifact download failed', { status: response.status });
      throw this.createApiError(errorText, 'Artifact download failed');
    }

    return this.parseArtifactBlob(response);
  }

  /**
   * vSUMS: Create
   */
  async createVsum(data: { name: string; description?: string }): Promise<ApiResponse<Vsum>> {
    return this.authenticatedRequest('/api/v1/vsums', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * vSUMS: Update name and meta model links
   */
  async updateVsumSyncChanges(
    id: number | string,
    data: VsumSyncChangesPutRequest
  ): Promise<ApiResponse<any>> {
    return this.authenticatedRequest(`/api/v1/vsums/${id}/sync-changes`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // inside ApiService class
  async renameVsum(id: number | string, data: { name: string }): Promise<ApiResponse<any>> {
    return this.authenticatedRequest(`/api/v1/vsums/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * vSUMS: Sync changes with relationship data
   */
  async syncVsumChanges(
    id: number | string,
    data: VsumSyncChangesPutRequest,
  ): Promise<ApiResponse<any>> {
    return this.updateVsumSyncChanges(id, data);
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
   * vSUMS: Version history for a non-deleted VSUM
   * GET /api/v1/vsum-histories/find-all/vsumId={vsumId}
   */
  async getVsumVersions(vsumId: number | string): Promise<ApiResponse<Array<{ id: number; createdAt: string }>>> {
    return this.authenticatedRequest(`/api/v1/vsum-histories/find-all/vsumId=${vsumId}`);
  }

  /**
   * vSUMS: Delete
   */
  async deleteVsum(id: number | string): Promise<ApiResponse<Record<string, never>>> {
    return this.authenticatedRequest(`/api/v1/vsums/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * vSUMS: Recover a previously removed VSUM
   */
  async recoverVsum(id: number | string): Promise<ApiResponse<Record<string, never>>> {
    return this.authenticatedRequest(`/api/v1/vsums/${id}/recovery`, {
      method: 'PUT',
    });
  }

  /**
   * vSUMS: Restore to a specific version
   * PUT /api/v1/vsums/{id}/recovery
   */
  async restoreVsumVersion(vsumId: number | string, versionId: number | string): Promise<ApiResponse<Record<string, never>>> {
    return this.authenticatedRequest(`/api/v1/vsums/${versionId}/recovery`, {
      method: 'PUT',
    });
  }

  /**
   * VSUM USERS: Fetch members of a VSUM
   * GET /v1/vsum-users/vsumId={vsumId}
   */
  async getVsumMembers(vsumId: number | string): Promise<ApiResponse<VsumUserResponse[]>> {
    return this.authenticatedRequest(`/api/v1/vsum-users/vsumId=${vsumId}`);
  }

  /**
   * VSUM USERS: Add member to a VSUM
   * POST /v1/vsum-users/add-member
   * body: { vsumId, userId }
   */
  async addVsumMember(vsumId: number | string, payload: { userId: number }): Promise<ApiResponse<null[]>> {
    const body: VsumUserPostRequest = {
      vsumId: Number(vsumId),
      userId: payload.userId,
    };
    return this.authenticatedRequest('/api/v1/vsum-users/add-member', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * VSUM USERS: Remove member (by vsum-user row id)
   * DELETE /v1/vsum-users/{id}/remove-member
   */
  async removeVsumMember(id: number | string): Promise<ApiResponse<null>> {
    return this.authenticatedRequest(`/api/v1/vsum-users/${id}/remove-member`, {
      method: 'DELETE',
    });
  }

  /**
   * VSUM USERS: Invite a viewer by email (read-only access)
   * POST /api/v1/vsum-users/invite
   * body: { vsumId, email }
   */
  async inviteVsumViewer(
    vsumId: number | string,
    payload: { email: string },
  ): Promise<ApiResponse<Record<string, never>>> {
    const body: VsumUserInviteRequest = {
      vsumId: Number(vsumId),
      email: payload.email.trim(),
    };
    return this.authenticatedRequest('/api/v1/vsum-users/invite', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * USERS: Search people to add (🔧 adjust this to your real endpoint)
   * Examples:
   *   GET  /api/v1/users/search?q=...&limit=10
   *   POST /api/v1/users/search { q, limit }
   */
  async searchUsers(params: { pageNumber?: number; pageSize?: number })
    : Promise<ApiResponse<UserSearchItem[]>> {
    const pageNumber = params.pageNumber ?? 0;
    const pageSize = params.pageSize ?? 50;
    return this.authenticatedRequest(`/api/v1/users/search?pageNumber=${pageNumber}&pageSize=${pageSize}`);
  }

  private async updateUploadedFile(
    fileId: number | string,
    file: File,
    endpointSuffix: 'update-reaction' | 'update-ecore',
    logLabel: string,
  ): Promise<{ data: string; message: string }> {
    const token = await AuthService.ensureValidToken();

    if (!token) {
      throw new Error('No valid authentication token available');
    }

    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseURL}/api/upload/${fileId}/${endpointSuffix}`;

    const doRequest = async (authHeader: string) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch { /* ignore */ }
        let errorMessage = errorText;
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed?.message || parsed?.error || errorText;
        } catch { /* ignore */ }

        console.error(`${logLabel} failed`, { status: response.status });

        const err = new Error(errorMessage || `Request failed with status ${response.status}`) as Error & { status?: number };
        err.status = response.status;
        throw err;
      }

      return await response.json() as { data: string; message: string };
    };

    try {
      return await doRequest(`Bearer ${token}`);
    } catch (err: unknown) {
      if (err instanceof Error && /401/.test(err.message)) {
        try {
          await AuthService.refreshToken();
          const newToken = await AuthService.ensureValidToken();
          if (newToken) {
            return await doRequest(`Bearer ${newToken}`);
          }
        } catch {
          console.error(`Token refresh failed during ${logLabel}`);
        }
      }
      throw err;
    }
  }

  async updateReactionFile(
    fileId: number | string,
    file: File,
  ): Promise<{ data: string; message: string }> {
    return this.updateUploadedFile(fileId, file, 'update-reaction', 'Update reaction file');
  }

  async updateEcoreFile(
    fileId: number | string,
    file: File,
  ): Promise<{ data: string; message: string }> {
    return this.updateUploadedFile(fileId, file, 'update-ecore', 'Update ecore file');
  }

  // Removed unused getBaseURL and setBaseURL helpers

  // ── Constraint Rule Sets ──────────────────────────────────────────────────

  getRuleSets(vsumId: number): Promise<RuleSetResponse[]> {
    return this.authenticatedRequest(`/api/v1/vsums/${vsumId}/rule-sets`);
  }

  createRuleSet(vsumId: number, body: RuleSetPostRequest): Promise<RuleSetResponse> {
    return this.authenticatedRequest(`/api/v1/vsums/${vsumId}/rule-sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  updateRuleSet(vsumId: number, ruleSetId: number, body: RuleSetPutRequest): Promise<RuleSetResponse> {
    return this.authenticatedRequest(`/api/v1/vsums/${vsumId}/rule-sets/${ruleSetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  deleteRuleSet(vsumId: number, ruleSetId: number): Promise<void> {
    return this.authenticatedRequest(`/api/v1/vsums/${vsumId}/rule-sets/${ruleSetId}`, {
      method: 'DELETE',
    });
  }
}

// Export a singleton instance
export const apiService = new ApiService();

export interface RuleSetResponse {
  id: number;
  vsumId: number;
  name: string;
  color: string;
  description: string | null;
  oclContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleSetPostRequest {
  name: string;
  color?: string;
  description?: string;
  oclContent?: string;
}

export interface RuleSetPutRequest {
  name: string;
  color?: string;
  description?: string;
  oclContent?: string;
}

// Example API methods using the authenticated service
// Removed unused userApi and projectApi helpers

// Export the class for testing or custom instances
export { ApiService };


export type VsumRole = 'OWNER' | 'MEMBER' | 'VIEWER';

export interface VsumUserResponse {
  id: number;
  vsumId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: VsumRole;
  roleEn?: string;
  /** True when the invitee has not registered yet */
  pending?: boolean;
  status?: 'ACTIVE' | 'PENDING';
  createdAt: string;
}

export interface VsumUserPostRequest {
  vsumId: number;
  userId: number;
}

export interface VsumUserInviteRequest {
  vsumId: number;
  email: string;
}

export interface UserSearchItem {
  id: number;
  firstName?: string;
  lastName?: string;
  email: string;
}

export interface MetaModelRelationRequest {
  sourceId: number;
  targetId: number;
  reactionFileId: number;  // Use 0 when there's no reaction file
}

export interface VsumSyncChangesPutRequest {
  metaModelIds: number[];
  metaModelRelationRequests: MetaModelRelationRequest[] | null; // you said null for now
}
