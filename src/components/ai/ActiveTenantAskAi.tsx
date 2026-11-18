import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantQuery } from "@/api/queries/TenantQuery";
import type { TenantQuery as TenantQueryType } from "@/api/queries/__generated__/TenantQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import AskAiButton from "./AskAiButton";
import { askAiSubjectFromTenant } from "./askAiSubjectName";

/**
 * Ask AI for the workspace tenant the sidebar switcher is showing.
 * The label is Tenant.name — the same string as the picker — not a
 * title-cased spark-form slug.
 */
export default function ActiveTenantAskAi({
  variant = "lime",
  className,
  chat = false,
}: {
  variant?: "lime" | "text";
  className?: string;
  /** Open brand chat instead of the one-question pop-up. */
  chat?: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const tenantUuid = useAuthStore((state) => state.tenantUuid);
  const tenantId = useAuthStore((state) => state.tenantId);
  const data = useLazyLoadQuery<TenantQueryType>(
    TenantQuery,
    { userUuid: user?.uuid ?? "" },
    { fetchPolicy: "store-or-network" },
  );
  const nodes =
    data?.tenants?.edges
      ?.map((edge) => edge?.node)
      ?.filter((node): node is NonNullable<typeof node> => Boolean(node)) ??
    [];
  const current =
    nodes.find((node) => String(node.uuid) === String(tenantUuid ?? "")) ??
    nodes.find((node) => node.id === tenantId);

  return (
    <AskAiButton
      tenantId={tenantId}
      tenantName={askAiSubjectFromTenant({
        name: current?.name,
        requestUrlName: current?.requestUrlName,
      })}
      variant={variant}
      className={className}
      chat={chat}
    />
  );
}
