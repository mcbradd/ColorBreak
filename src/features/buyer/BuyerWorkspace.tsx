import { Workspace } from "../workflow/WorkflowImplementation";

/** Buyer feature boundary.  All buyer state remains private to Workspace. */
export function BuyerWorkspace({
  exit,
  startFresh,
  startReady,
}: {
  exit: () => void;
  startFresh: boolean;
  startReady: boolean;
}) {
  return <Workspace mode="buyer" exit={exit} startFresh={startFresh} startReady={startReady} />;
}
