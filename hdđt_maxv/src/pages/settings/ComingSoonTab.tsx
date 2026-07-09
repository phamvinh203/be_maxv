import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ConstructionRounded from "@mui/icons-material/ConstructionRounded";

interface Props {
  title: string;
}

export default function ComingSoonTab({ title }: Props) {
  return (
    <Box
      sx={{
        py: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        color: "text.disabled",
      }}
    >
      <ConstructionRounded fontSize="large" />
      <Typography variant="h6" sx={{ color: "text.secondary" }}>
        {title}
      </Typography>
      <Typography variant="body2">Tính năng đang phát triển.</Typography>
    </Box>
  );
}
