import { installExternalNetworkGuard } from './deliveryEdgeEvidence'

const previousDisablePayloadHmr = process.env.DISABLE_PAYLOAD_HMR
process.env.DISABLE_PAYLOAD_HMR = 'true'

export const deliveryEdgeNetworkGuard = installExternalNetworkGuard('delivery-edge evidence contract')

export function closeDeliveryEdgeNetworkBoundary() {
  deliveryEdgeNetworkGuard.restore()
  if (previousDisablePayloadHmr === undefined) delete process.env.DISABLE_PAYLOAD_HMR
  else process.env.DISABLE_PAYLOAD_HMR = previousDisablePayloadHmr
}
