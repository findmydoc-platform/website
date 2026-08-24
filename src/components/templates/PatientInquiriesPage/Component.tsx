import Link from 'next/link'

import { Button } from '@/components/atoms/button'
import { PatientInquiryConversation } from '@/components/organisms/PatientInquiryConversation/Component'
import { PatientInquiryQueue } from '@/components/organisms/PatientInquiryQueue/Component'
import type { PatientInquiriesState } from '@/features/patientInquiries/model'
import type { PatientInquiryDetailView } from '@/features/patientInquiries/viewModel'
import { cn } from '@/utilities/ui'

export type PatientInquiriesPageActions = {
  clearFailedMessage: () => void
  goBack: () => void
  retryDetail: () => void
  retryQueue: () => void
  retrySend: () => void
  selectFilter: PatientInquiryQueueProps['onFilterChange']
  selectInquiry: PatientInquiryQueueProps['onSelect']
  selectFile: (file?: File) => void
  sendMessage: () => void
  updateMessage: (text: string) => void
}

type PatientInquiryQueueProps = React.ComponentProps<typeof PatientInquiryQueue>

type PatientInquiriesPageProps = {
  actions: PatientInquiriesPageActions
  detailView?: PatientInquiryDetailView
  loginHref: string
  mode: 'detail' | 'index'
  state: PatientInquiriesState
}

export function PatientInquiriesPage({ actions, detailView, loginHref, mode, state }: PatientInquiriesPageProps) {
  if (state.sessionEnded) {
    return (
      <main className="bg-site-section px-4 py-10 sm:px-6 lg:py-14">
        <section className="mx-auto flex min-h-[32rem] max-w-2xl flex-col items-center justify-center rounded-xl border border-border bg-card px-6 text-center shadow-xs">
          <h1 className="text-3xl font-bold text-secondary">Your session has ended</h1>
          <p className="mt-3 text-muted-foreground">Sign in again to view your private inquiries.</p>
          <Button asChild className="mt-7 min-w-52">
            <Link href={loginHref}>Sign in</Link>
          </Button>
        </section>
      </main>
    )
  }

  return (
    <main className="bg-site-section px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-[90rem]">
        <header className={cn('mb-6', mode === 'detail' && 'hidden lg:block')}>
          <p className="text-sm font-semibold text-primary sm:text-base">Patient account</p>
          <h1 className="mt-2 text-left text-3xl font-bold tracking-tight text-secondary sm:text-4xl">My inquiries</h1>
        </header>

        <div className="lg:grid lg:grid-cols-[28rem_minmax(0,1fr)] lg:items-start lg:gap-7">
          <div className={cn(mode === 'detail' && 'hidden lg:block')}>
            <PatientInquiryQueue
              data={state.queue.data}
              error={state.queue.error}
              filter={state.filter}
              onFilterChange={actions.selectFilter}
              onRetry={actions.retryQueue}
              onSelect={actions.selectInquiry}
              refreshError={state.queue.refreshError}
              selectedInquiryId={state.selectedInquiryId}
              status={state.queue.status}
            />
          </div>

          <div className={cn(mode === 'index' && 'hidden lg:block')}>
            {state.selectedInquiryId || mode === 'detail' ? (
              <PatientInquiryConversation
                composer={state.composer}
                detail={detailView}
                error={state.detail.error}
                onBack={actions.goBack}
                onClearFailed={actions.clearFailedMessage}
                onFileChange={actions.selectFile}
                onRetry={actions.retryDetail}
                onRetrySend={actions.retrySend}
                onSend={actions.sendMessage}
                onTextChange={actions.updateMessage}
                status={state.detail.status}
              />
            ) : (
              <section className="flex min-h-[34rem] items-center justify-center rounded-xl border border-border bg-card px-8 text-center text-muted-foreground shadow-xs">
                Select an inquiry to read the conversation.
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
