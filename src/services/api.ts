import { FlowData } from '../types/flow';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';

export class ApiService {
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  static async deployFlow(flowData: FlowData): Promise<{ success: boolean; message: string }> {
    return this.request('/deploy', {
      method: 'POST',
      body: JSON.stringify(flowData),
    });
  }

  static async saveFlow(flowData: FlowData, flowId?: string): Promise<{ id: string; success: boolean }> {
    const endpoint = flowId ? `/flows/${flowId}` : '/flows';
    const method = flowId ? 'PUT' : 'POST';
    
    return this.request(endpoint, {
      method,
      body: JSON.stringify(flowData),
    });
  }

  static async loadFlow(flowId: string): Promise<FlowData> {
    return this.request(`/flows/${flowId}`);
  }

  static async listFlows(): Promise<{ id: string; name: string; createdAt: string }[]> {
    return this.request('/flows');
  }

  static async deleteFlow(flowId: string): Promise<{ success: boolean }> {
    return this.request(`/flows/${flowId}`, {
      method: 'DELETE',
    });
  }
} 