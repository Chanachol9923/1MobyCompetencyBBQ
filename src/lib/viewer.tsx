"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { can, canAny, type PermissionKey } from "@/lib/permissions";

/**
 * Who is looking at the screen, handed down from the server layout.
 *
 * This replaces the demo store's notion of "current role". The server already
 * decided what this person may do; the client only uses it to decide what to
 * draw, never to decide what is allowed.
 */
export type ClientViewer = {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  roleKey: string | null;
  roleName: string | null;
  roleNameTh: string | null;
  permissions: string[];
  employeeId: string | null;
  employeeName: string | null;
  jobRoleName: string | null;
  level: string | null;
  reportCount: number;
};

const ViewerContext = createContext<ClientViewer | null>(null);

export function ViewerProvider({
  viewer,
  children,
}: {
  viewer: ClientViewer;
  children: ReactNode;
}) {
  const value = useMemo(() => viewer, [viewer]);
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer(): ClientViewer {
  const v = useContext(ViewerContext);
  if (!v) throw new Error("useViewer must be used inside <ViewerProvider>");
  return v;
}

/** Safe outside the provider — returns null rather than throwing. */
export function useOptionalViewer(): ClientViewer | null {
  return useContext(ViewerContext);
}

export function usePermission() {
  const viewer = useViewer();
  return useMemo(
    () => ({
      can: (key: PermissionKey) => can(viewer.permissions, key),
      canAny: (keys: PermissionKey[]) => canAny(viewer.permissions, keys),
    }),
    [viewer.permissions],
  );
}
