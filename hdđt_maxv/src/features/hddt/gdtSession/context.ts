import { createContext } from "react";
import type { GdtSessionContextValue } from "../types";

export const GdtSessionContext = createContext<GdtSessionContextValue | null>(null);
