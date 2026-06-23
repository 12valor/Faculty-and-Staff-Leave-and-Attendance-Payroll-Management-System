"use client";

import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import { Button } from "@/components/ui/button";

export function PrintPayslipButton() {
  return <Button onClick={() => window.print()}><PrintRoundedIcon data-icon="inline-start" />Print Payslip</Button>;
}
