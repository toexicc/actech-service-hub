import { toast } from "sonner";

export interface AppError {
  message: string;
  code?: string;
  details?: any;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export class APIError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "APIError";
  }
}

export const handleError = (error: unknown, context?: string): void => {
  console.error(`Error in ${context || 'application'}:`, error);

  if (error instanceof ValidationError) {
    toast.error("Validation Error", {
      description: error.message,
    });
  } else if (error instanceof NetworkError) {
    toast.error("Network Error", {
      description: "Unable to connect to the server. Please check your internet connection and try again.",
    });
  } else if (error instanceof APIError) {
    toast.error("API Error", {
      description: error.message || "An error occurred while processing your request.",
    });
  } else if (error instanceof Error) {
    toast.error("Error", {
      description: error.message || "An unexpected error occurred. Please try again.",
    });
  } else {
    toast.error("Error", {
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

export const withErrorHandling = async <T>(
  fn: () => Promise<T>,
  context?: string,
  onError?: (error: unknown) => void
): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    if (onError) {
      onError(error);
    }
    return null;
  }
};

export const validateResponse = (response: Response): void => {
  if (!response.ok) {
    if (response.status === 404) {
      throw new APIError("Resource not found", "NOT_FOUND");
    } else if (response.status === 401) {
      throw new APIError("Unauthorized access", "UNAUTHORIZED");
    } else if (response.status === 403) {
      throw new APIError("Access forbidden", "FORBIDDEN");
    } else if (response.status >= 500) {
      throw new APIError("Server error. Please try again later.", "SERVER_ERROR");
    } else {
      throw new APIError(`Request failed with status ${response.status}`, "UNKNOWN_ERROR");
    }
  }
};

export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
};
