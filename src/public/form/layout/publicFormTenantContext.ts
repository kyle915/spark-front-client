import { createContext } from "react";
import type { TenantPublic } from "../hooks/useTenantPublic";

export const PublicFormTenantContext = createContext<TenantPublic | null>(null);
