import type { H3EventContext } from "h3";

declare module "h3" {
  interface H3EventContext {
    userId?: string;
  }
}
