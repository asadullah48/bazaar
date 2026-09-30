// Demo is a deliberate build mode, never a fallback for a failing live API.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
  (process.env.NEXT_PUBLIC_DEMO_MODE !== "false" && !process.env.NEXT_PUBLIC_API_URL);
