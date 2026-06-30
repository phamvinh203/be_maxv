import { createRootRoute, Outlet } from '@tanstack/react-router';

/** Route gốc — chỉ render <Outlet /> cho cây route con. */
export const rootRoute = createRootRoute({ component: () => <Outlet /> });
