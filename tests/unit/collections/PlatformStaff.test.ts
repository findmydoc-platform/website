import { describe, it, expect } from 'vitest'
import { PlatformStaff } from '@/collections/PlatformStaff'

describe('PlatformStaff collection', () => {
  it('should have correct collection configuration', () => {
    expect(PlatformStaff.slug).toBe('platformStaff')
    expect(PlatformStaff.auth).toBe(false)
    expect(PlatformStaff.admin?.group).toBe('User Management')
    expect(PlatformStaff.admin?.useAsTitle).toBe('firstName')
  })

  it('should have all fields as direct children (no row grouping)', () => {
    const fields = PlatformStaff.fields
    
    // Should have 5 fields: firstName, lastName, user, role, profileImage
    expect(fields).toHaveLength(5)
    
    // Check that no field is of type 'row'
    const hasRowField = fields.some((field: any) => field.type === 'row')
    expect(hasRowField).toBe(false)
    
    // Check that firstName and lastName are direct fields
    const fieldNames = fields.map((field: any) => field.name)
    expect(fieldNames).toContain('firstName')
    expect(fieldNames).toContain('lastName')
    expect(fieldNames).toContain('user')
    expect(fieldNames).toContain('role')
    expect(fieldNames).toContain('profileImage')
  })

  it('should have firstName field configured correctly', () => {
    const firstNameField: any = PlatformStaff.fields.find((field: any) => field.name === 'firstName')
    
    expect(firstNameField).toBeDefined()
    expect(firstNameField.type).toBe('text')
    expect(firstNameField.label).toBe('First Name')
    expect(firstNameField.required).toBe(true)
    
    // Should not have width constraints (no admin.width property)
    expect(firstNameField.admin?.width).toBeUndefined()
  })

  it('should have lastName field configured correctly', () => {
    const lastNameField: any = PlatformStaff.fields.find((field: any) => field.name === 'lastName')
    
    expect(lastNameField).toBeDefined()
    expect(lastNameField.type).toBe('text')
    expect(lastNameField.label).toBe('Last Name')
    expect(lastNameField.required).toBe(true)
    
    // Should not have width constraints (no admin.width property)
    expect(lastNameField.admin?.width).toBeUndefined()
  })

  it('should have user relationship field configured correctly', () => {
    const userField: any = PlatformStaff.fields.find((field: any) => field.name === 'user')
    
    expect(userField).toBeDefined()
    expect(userField.type).toBe('relationship')
    expect(userField.relationTo).toBe('basicUsers')
    expect(userField.required).toBe(true)
    expect(userField.unique).toBe(true)
    expect(userField.hasMany).toBe(false)
  })

  it('should have role select field configured correctly', () => {
    const roleField: any = PlatformStaff.fields.find((field: any) => field.name === 'role')
    
    expect(roleField).toBeDefined()
    expect(roleField.type).toBe('select')
    expect(roleField.required).toBe(true)
    expect(roleField.defaultValue).toBe('support')
    expect(roleField.options).toHaveLength(3)
    
    const optionValues = roleField.options.map((opt: any) => opt.value)
    expect(optionValues).toContain('admin')
    expect(optionValues).toContain('support')
    expect(optionValues).toContain('content-manager')
  })

  it('should have profileImage upload field configured correctly', () => {
    const profileImageField: any = PlatformStaff.fields.find((field: any) => field.name === 'profileImage')
    
    expect(profileImageField).toBeDefined()
    expect(profileImageField.type).toBe('upload')
    expect(profileImageField.relationTo).toBe('media')
    expect(profileImageField.required).toBe(false)
  })
})