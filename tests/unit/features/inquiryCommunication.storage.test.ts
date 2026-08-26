import { describe, expect, it } from 'vitest'

import { buildInquiryAttachmentContentDisposition } from '@/features/inquiryCommunication/storage'

describe('inquiry attachment response headers', () => {
  it('builds safe ASCII and RFC 5987 file-name parameters', () => {
    const header = buildInquiryAttachmentContentDisposition('inline', `Befund O'Brien (final).pdf`)

    expect(header).toBe(
      `inline; filename="Befund O_Brien _final_.pdf"; filename*=UTF-8''Befund%20O%27Brien%20%28final%29.pdf`,
    )
  })

  it('keeps unicode only in the percent-encoded parameter and neutralizes quotes', () => {
    const header = buildInquiryAttachmentContentDisposition('attachment', 'Ärztlicher "Befund".pdf')

    expect(header).toContain('filename="_rztlicher _Befund_.pdf"')
    expect(header).toContain("filename*=UTF-8''%C3%84rztlicher%20_Befund_.pdf")
  })

  it.each(['bad\r\nname.pdf', 'bad\u0000name.pdf', 'bad\u007fname.pdf'])(
    'rejects control characters in %s',
    (fileName) => {
      expect(() => buildInquiryAttachmentContentDisposition('attachment', fileName)).toThrow(/invalid/i)
    },
  )
})
