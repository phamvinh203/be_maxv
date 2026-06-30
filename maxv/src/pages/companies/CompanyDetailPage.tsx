import { Suspense, type JSX } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Loading } from "@/components/Loading";
import { CompanyDetail } from "@/features/companies/components/CompanyDetail";

export function CompanyDetailPage({
  companyId,
}: {
  companyId: string;
}): JSX.Element {
  return (
    <Stack spacing={2}>
      <Button
        component={Link}
        to="/companies"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: "start" }}
      >
        Danh sách đơn vị
      </Button>

      <Suspense fallback={<Loading />}>
        <CompanyDetail id={companyId} />
      </Suspense>
    </Stack>
  );
}
