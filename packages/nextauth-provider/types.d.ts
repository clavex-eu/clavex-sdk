// Opt-in Auth.js type augmentation for Clavex.
//
// Import once anywhere in your project (e.g. a next-auth.d.ts file):
//
//   import "@clavex/nextauth-provider/types";
//
// This adds the Clavex-specific claims that ClavexProvider maps onto the
// next-auth User, Session and JWT types.

export {};

declare module "next-auth" {
  interface User {
    orgId?: string | null;
    roles?: string[];
    groups?: string[];
    acr?: string | null;
  }

  interface Session {
    user: User & {
      orgId?: string | null;
      roles?: string[];
      groups?: string[];
      acr?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    orgId?: string | null;
    roles?: string[];
    groups?: string[];
    acr?: string | null;
  }
}
