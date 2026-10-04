// Shared contract between front-end and back-end code.

export type Role = "public" | "internal";

export type CurrentUser = {
  id: string;
  email: string | null;
  role: Role;
  fullName: string | null;
  companyName: string | null;
};
