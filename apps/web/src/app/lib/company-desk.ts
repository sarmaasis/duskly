import { Injectable, signal } from "@angular/core";
import { api } from "./api";
import { lsGet, lsSet } from "./browser";

export type DeskAccount = { id: string; handle: string; network: string };
export type DeskCompany = { id: string; name: string; accountIds: string[]; accounts: DeskAccount[] };

const KEY = "dk-company";

@Injectable({ providedIn: "root" })
export class CompanyDesk {
  companies = signal<DeskCompany[]>([]);
  selectedId = signal("");

  async load(workspaceId: string) {
    try {
      const data = await api<{
        groups: { id: string; name: string; accountIds?: string[]; accounts?: DeskAccount[] }[];
      }>(`/v1/org/groups?workspaceId=${workspaceId}`);
      const companies = (data.groups || []).map((group) => {
        const accounts = group.accounts || [];
        const accountIds = group.accountIds?.length ? group.accountIds : accounts.map((account) => account.id);
        return { id: group.id, name: group.name, accountIds, accounts };
      });
      this.companies.set(companies);
      const saved = lsGet(KEY) || "";
      this.selectedId.set(companies.some((company) => company.id === saved) ? saved : "");
    } catch {
      this.companies.set([]);
    }
  }

  scopeQuery(workspaceId: string) {
    const params = new URLSearchParams({ workspaceId });
    const id = this.selectedId();
    if (id) params.set("groupId", id);
    return params.toString();
  }

  select(id: string) {
    this.selectedId.set(id);
    lsSet(KEY, id);
  }

  current() {
    const id = this.selectedId();
    return this.companies().find((company) => company.id === id) || null;
  }

  allowsAccount(accountId: string | undefined) {
    const company = this.current();
    if (!company) return true;
    return !!accountId && company.accountIds.includes(accountId);
  }

  allowsPost(accountIds: (string | undefined)[] | undefined) {
    const company = this.current();
    if (!company) return true;
    return (accountIds || []).some((id) => !!id && company.accountIds.includes(id));
  }

  allowsHandle(network: string, handle: string) {
    const company = this.current();
    if (!company) return true;
    return company.accounts.some((account) => account.network === network && account.handle === handle);
  }
}
