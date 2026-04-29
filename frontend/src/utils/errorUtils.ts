import axios from "axios";

type ApiErrorData = {
  code?: string;
  message?: string;
  errors?: unknown;
  projectId?: number;
};

export function getErrorStatus(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;
  return error.response?.status ?? null;
}

export function getErrorData<T extends ApiErrorData = ApiErrorData>(
  error: unknown
): T | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  return error.response?.data as T | undefined;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const status = getErrorStatus(error);
  if (status === 502 || status === 503 || status === 504) {
    return "The server is still waking up. Please wait a few seconds and try again.";
  }

  const responseMessage = getErrorData(error)?.message;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
