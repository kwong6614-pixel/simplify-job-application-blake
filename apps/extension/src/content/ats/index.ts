import { ashbyAdapter } from "./ashby";
import { genericAdapter } from "./generic";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { smartRecruitersAdapter } from "./smartrecruiters";
import type { AtsAdapter } from "./shared";
import { workdayAdapter } from "./workday";

const ADAPTERS: AtsAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  workdayAdapter,
  smartRecruitersAdapter,
  genericAdapter,
];

export function getAtsAdapter(hostname: string, url: string): AtsAdapter {
  return ADAPTERS.find((adapter) => adapter.matches(hostname, url)) ?? genericAdapter;
}

export type { AtsAdapter } from "./shared";
