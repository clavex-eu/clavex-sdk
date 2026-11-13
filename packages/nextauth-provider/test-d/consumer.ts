import NextAuth from "next-auth";
import { ClavexProvider } from "../dist/index.js";

// Compile the generated declarations as an application would consume them.
NextAuth({ providers: [ClavexProvider({ issuer: "https://issuer.example/acme", clientId: "example", clientSecret: "test-only" })] });
