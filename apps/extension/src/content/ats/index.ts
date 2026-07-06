import { ashbyAdapter, isAshbyEmbedOnCustomDomain } from "./ashby";
import { genericAdapter } from "./generic";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { smartRecruitersAdapter } from "./smartrecruiters";
import type { AtsAdapter } from "./shared";
import { workdayAdapter } from "./workday";

const HOST_ADAPTERS: AtsAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  workdayAdapter,
  smartRecruitersAdapter,
];

export function getAtsAdapter(hostname: string, url: string, document?: Document): AtsAdapter {
  const hostAdapter = HOST_ADAPTERS.find((adapter) => adapter.matches(hostname, url));
  if (hostAdapter) return hostAdapter;

  if (document && isAshbyEmbedOnCustomDomain(document, url)) {
    return ashbyAdapter;
  }

  return genericAdapter;
}

export type { AtsAdapter } from "./shared";
