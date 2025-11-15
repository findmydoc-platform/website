'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type SearchBlockProps = {
  title?: string
}

export const SearchBlock: React.FC<SearchBlockProps> = ({ title }) => {
  const router = useRouter()
  const [services, setServices] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])

  const [formData, setFormData] = useState({
    service: '',
    location: '',
    budget: '',
  })

  useEffect(() => {
    fetch('/api/treatments?limit=100')
      .then((res) => res.json())
      .then((data) => {
        const names = data?.docs?.map((t: any) => t.name).filter(Boolean)
        setServices(names || [])
      })

    fetch('/api/cities?limit=100')
      .then((res) => res.json())
      .then((data) => {
        const names = data?.docs?.map((c: any) => c.name).filter(Boolean)
        setCities(names || [])
      })
  }, [])

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (formData.service) params.set('service', formData.service)
    if (formData.location) params.set('location', formData.location)
    if (formData.budget) params.set('budget', formData.budget)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <section className="py-10">
      <div className="container max-w-4xl">
        {title && <h2 className="mb-6 text-lg font-semibold">{title}</h2>}
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-4 shadow-md md:p-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="md:w-1/4 md:border-r md:pr-4">
              <label className="mb-1 block text-sm font-medium text-foreground">Treatment</label>
              <Select onValueChange={(val) => setFormData({ ...formData, service: val })}>
                <SelectTrigger className="w-full rounded-none border-none shadow-none ring-0 focus:ring-0">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:w-1/3 md:border-r md:pr-4">
              <label className="mb-1 block text-sm font-medium text-foreground">Location</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start rounded-none border-none text-left shadow-none focus:ring-0"
                  >
                    {formData.location || 'Search city...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full rounded-none rounded-br-2xl border border-border p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search cities..."
                      onValueChange={(val) => {
                        const match = cities.find((c) => c.toLowerCase().startsWith(val.toLowerCase()))
                        if (match) setFormData({ ...formData, location: match })
                      }}
                    />
                    <CommandEmpty>Location not available</CommandEmpty>
                    <CommandGroup>
                      {cities.map((city) => (
                        <CommandItem key={city} onSelect={() => setFormData({ ...formData, location: city })}>
                          {city}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="md:w-1/4 md:px-4">
              <label className="mb-1 block text-sm font-medium text-foreground">Budget</label>
              <Input
                type="number"
                step={100}
                placeholder="e.g. 12000"
                className="rounded-none border-none shadow-none focus:ring-0"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              />
            </div>

            <div className="flex items-center md:w-1/5 md:pl-4">
              <Button
                className="w-full whitespace-nowrap border-none hover:bg-secondary hover:text-accent"
                variant="default"
                onClick={handleSearch}
              >
                Search
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
