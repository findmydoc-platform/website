export type LandingTestimonialImage =
  | string
  | {
      src: string
      alt?: string
      width?: number
      height?: number
      sizes?: string
      quality?: number
      objectPosition?: string
    }

export type LandingTestimonial = {
  quote: string
  author: string
  role: string
  image: LandingTestimonialImage
}
