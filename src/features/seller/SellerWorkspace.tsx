import { Workspace } from "../workflow/WorkflowImplementation";

/** Seller feature boundary.  Seller plans are session-scoped inside Workspace. */
export function SellerWorkspace({ exit }: { exit: () => void }) {
  return <Workspace mode="seller" exit={exit} startFresh={false} startReady={false} />;
}
