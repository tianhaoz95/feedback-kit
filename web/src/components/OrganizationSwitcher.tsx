import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOrganization } from "@/lib/organization";
import { getErrorMessage } from "@/lib/errors";
import { Dropdown } from "@/components/Dropdown";
import { CheckIcon, ChevronUpDownIcon, PlusIcon, UsersIcon } from "@/components/icons";

/** Header control for choosing which organization the dashboard acts in. */
export function OrganizationSwitcher() {
  const navigate = useNavigate();
  const { organizations, current, switchOrganization, createOrganization } = useOrganization();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!organizations || !current) return null;

  async function submit(close: () => void) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await createOrganization(trimmed);
      setName("");
      setCreating(false);
      close();
      navigate("/projects");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't create the organization."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dropdown
      label="Switch organization"
      panelClassName="w-72"
      trigger={() => (
        <span className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 sm:max-w-[14rem]">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-900 text-[10px] font-semibold text-white">
            {current.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden truncate sm:inline">{current.name}</span>
          <ChevronUpDownIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        </span>
      )}
    >
      {(close) => (
        <div className="py-1.5">
          <p className="px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Organizations
          </p>
          <ul className="max-h-64 overflow-y-auto">
            {organizations.map((org) => (
              <li key={org.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (org.id !== current.id) {
                      switchOrganization(org.id);
                      navigate("/projects");
                    }
                    close();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-100 text-[10px] font-semibold text-neutral-600">
                    {org.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{org.name}</span>
                  <span className="text-[11px] capitalize text-neutral-400">{org.role}</span>
                  {org.id === current.id ? <CheckIcon className="h-4 w-4 text-neutral-900" /> : <span className="w-4" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="my-1.5 border-t border-neutral-100" />
          <Link
            to="/team"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            <UsersIcon className="h-4 w-4 text-neutral-400" />
            Team &amp; invitations
          </Link>
          {creating ? (
            <form
              className="space-y-2 px-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(close);
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Organization name"
                className="w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm outline-none focus:border-neutral-400"
              />
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreating(false)} className="text-xs text-neutral-500 hover:text-neutral-800">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <PlusIcon className="h-4 w-4 text-neutral-400" />
              New organization
            </button>
          )}
        </div>
      )}
    </Dropdown>
  );
}
