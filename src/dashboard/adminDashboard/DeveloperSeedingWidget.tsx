import type { WidgetServerProps } from 'payload'

import { SeedingCardAdapter } from './SeedingCardAdapter.client'
import { resolveDashboardUserType } from './userType'

const DeveloperSeedingWidget: React.FC<WidgetServerProps> = (props) => {
  const user = props.req?.user ?? null
  const forcedUserType = resolveDashboardUserType(user)

  return <SeedingCardAdapter controls={props.widgetData} forcedUserType={forcedUserType} />
}

export default DeveloperSeedingWidget
