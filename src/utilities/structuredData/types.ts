export type JsonLdPrimitive = string | number | boolean

export type JsonLdValue = JsonLdPrimitive | JsonLdObject | JsonLdValue[] | null | undefined

export type JsonLdObject = {
  [key: string]: JsonLdValue
}

export type JsonLdNode = JsonLdObject
