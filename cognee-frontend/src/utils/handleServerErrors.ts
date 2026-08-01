import { redirect } from "next/navigation";

export default function handleServerErrors(
  response: Response,
  retry: ((response: Response) => Promise<Response>) | null = null,
  useCloud: boolean = true,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    // Local mode: redirect to sign-in on auth failure (401 only; 403 lets the caller handle it)
    if (response.status === 401 && !useCloud) {
      if (typeof window !== "undefined") {
        window.location.href = "/sign-in";
      }
      return reject(new Error("Session expired"));
    }

    // 403 in local mode: show permission toast instead of redirecting
    if (response.status === 403 && !useCloud) {
      if (typeof window !== "undefined") {
        response.clone().text().then((text) => {
          let message = "You don't have permission to perform this action.";
          try {
            const parsed = JSON.parse(text);
            if (parsed.detail) message = parsed.detail;
          } catch { /* use default message */ }
          import("@mantine/notifications").then(({ notifications }) => {
            notifications.show({
              title: "Permission Denied",
              message,
              color: "red",
              autoClose: 5000,
            });
          });
        });
      }
      return reject(new Error("Permission denied"));
    }
    if ((response.status === 401 || response.status === 403) && useCloud) {
      // 403 = authenticated but not authorized for this resource.
      // Only redirect for email-verification; otherwise reject so callers
      // can handle the error gracefully (avoids redirect loops).
      if (response.status === 403) {
        return response.clone().text().then((text) => {
          if (text.toLowerCase().includes("verify your email")) {
            return redirect("/verify-email");
          }
          const error: Record<string, unknown> = { message: text || "Forbidden", status: 403, statusText: "Forbidden" };
          reject(error);
        });
      }
      // 401 = not authenticated — redirect to sign-in
      if (retry) {
        return retry(response)
          .catch(() => {
            return redirect("/sign-in");
          });
      } else {
        return redirect("/sign-in");
      }
    }
    if (!response.ok) {
      return response.text().then(text => {
        let error: Record<string, unknown> = {};
        try {
          error = JSON.parse(text);
        } catch {
          error = { message: text || response.statusText };
        }
        error.status = response.status;
        error.statusText = response.statusText;
        reject(error);
      });
    }

    if (response.status >= 200 && response.status < 300) {
      return resolve(response);
    }

    return reject(response);
  });
}
