import { createRoute } from "@tanstack/react-router";
import { adminRoute } from "./admin.route";
import { CompaniesPage } from "@/pages/companies/CompaniesPage";
import { CompanyDetailPage } from "@/pages/companies/CompanyDetailPage";

export const companiesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/companies",
  staticData: { title: "Đơn vị" },
  component: CompaniesPage,
});

export const companyDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/companies/$companyId",
  staticData: { title: "Chi tiết đơn vị" },
  component: () => {
    const { companyId } = companyDetailRoute.useParams();
    return <CompanyDetailPage companyId={companyId} />;
  },
});
