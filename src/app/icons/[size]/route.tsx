import { renderAppIcon } from "@/lib/app-icon";

const SIZES = ["192", "512"] as const;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  return renderAppIcon(Number(size));
}
