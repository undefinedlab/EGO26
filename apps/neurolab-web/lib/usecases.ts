/** Compatibility shim — prefer lib/blocks.ts */
export type { CaseId as UseCaseId } from "./blocks";
export { getCase as getUseCase, SIM_CASES as USE_CASES } from "./blocks";
