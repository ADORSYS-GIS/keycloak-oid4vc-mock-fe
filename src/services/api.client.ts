import keycloak from "../config/keycloak.config";

interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = import.meta.env.VITE_API_BASE_URL || "") {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(requireAuth: boolean = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (requireAuth && keycloak.token) {
      // Refresh token if needed
      try {
        await keycloak.updateToken(5);
        headers["Authorization"] = `Bearer ${keycloak.token}`;
      } catch (error) {
        console.error("Failed to refresh token:", error);
        keycloak.login();
      }
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const { requireAuth = true, ...fetchOptions } = options;

    const headers = await this.getHeaders(requireAuth);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers: {
        ...headers,
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        keycloak.login();
      }
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string, requireAuth = true): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", requireAuth });
  }

  async post<T>(
    endpoint: string,
    data: unknown,
    requireAuth = true,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      requireAuth,
    });
  }

  async put<T>(
    endpoint: string,
    data: unknown,
    requireAuth = true,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
      requireAuth,
    });
  }

  async delete<T>(endpoint: string, requireAuth = true): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE", requireAuth });
  }
}

export default new ApiClient();
