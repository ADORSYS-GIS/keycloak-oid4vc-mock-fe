export type IssuanceFlow = 'pre-authorized' | 'authorization-code';

export const DEFAULT_ISSUANCE_FLOW: IssuanceFlow = 'pre-authorized';

const ISSUANCE_FLOW_STORAGE_KEY = 'oid4vc_issuance_flow';

export const issuanceFlowLabels: Record<IssuanceFlow, string> = {
  'pre-authorized': 'Pre-authorized code flow',
  'authorization-code': 'Authorization code flow',
};

export function isIssuanceFlow(value: unknown): value is IssuanceFlow {
  return value === 'pre-authorized' || value === 'authorization-code';
}

export function getStoredIssuanceFlow(): IssuanceFlow {
  const stored = window.sessionStorage.getItem(ISSUANCE_FLOW_STORAGE_KEY);
  return isIssuanceFlow(stored) ? stored : DEFAULT_ISSUANCE_FLOW;
}

export function storeIssuanceFlow(flow: IssuanceFlow) {
  window.sessionStorage.setItem(ISSUANCE_FLOW_STORAGE_KEY, flow);
}
